import { loadDataFieldsForDatasets } from '@luzmo/analytics-components-kit/utils'
import { getSlotsConfigByItemType } from '@luzmo/dashboard-contents-types'
import type {
  VizSlotContent,
  VizSlot,
  PotentialMatch,
  DashboardSecurableResponse,
} from '../types'
import {
  LUZMO_AUTH_KEY,
  LUZMO_AUTH_TOKEN,
  LUZMO_API_HOST,
} from './constants'
import {
  isRecord,
  localizeText,
  humanizeVizType,
  normalizeSlots,
  preserveRawSlots,
  inferDatasetId,
  buildAiSummary,
  isSwipableChartItem,
  dedupeSlotContentsByColumn,
  extractDatasetColumnContentsFromRow,
  parseAiSummaryStreamText,
  parseAiSummaryErrorText,
  isAiSummaryStreamDone,
  mergeStreamSummaryText,
} from './helpers'

export async function consumeAiSummaryStream(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onPartial: (text: string) => void,
): Promise<{ text: string | null; error: string | null }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let accumulated = ''
  let streamError: string | null = null

  const processLine = (rawLine: string): boolean => {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      return false
    }

    if (trimmed.startsWith('event:') || trimmed.startsWith('id:')) {
      return false
    }

    const line = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed
    if (!line) {
      return false
    }

    if (line === '[DONE]') {
      return true
    }

    let payload: unknown = line
    try {
      payload = JSON.parse(line) as unknown
    } catch {
      payload = line
    }

    const errorText = parseAiSummaryErrorText(payload)
    if (errorText) {
      streamError = errorText
    }

    const chunkText = parseAiSummaryStreamText(payload)
    if (chunkText) {
      accumulated = mergeStreamSummaryText(accumulated, chunkText)
      onPartial(accumulated)
    }

    return isAiSummaryStreamDone(payload)
  }

  try {
    while (true) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const { value, done } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (processLine(line)) {
          await reader.cancel().catch(() => undefined)
          return { text: accumulated.trim() || null, error: streamError }
        }
      }
    }

    const remaining = decoder.decode()
    if (remaining) {
      buffer += remaining
    }
    if (buffer.trim()) {
      processLine(buffer)
    }

    return { text: accumulated.trim() || null, error: streamError }
  } finally {
    reader.releaseLock()
  }
}

export async function waitWithAbort(signal: AbortSignal, delayMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, delayMs)

    const onAbort = () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal.aborted) {
      onAbort()
      return
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function fetchDatasetNames(
  datasetIds: string[],
): Promise<Record<string, string>> {
  if (datasetIds.length === 0) {
    return {}
  }

  const results = await Promise.all(
    datasetIds.map(async (datasetId) => {
      const payload = {
        action: 'get',
        version: '0.1.0',
        key: LUZMO_AUTH_KEY,
        token: LUZMO_AUTH_TOKEN,
        find: {
          where: {
            id: datasetId,
            type: 'dataset',
          },
        },
      }

      try {
        const response = await fetch(
          `${LUZMO_API_HOST.replace(/\/$/, '')}/0.1.0/securable`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          },
        )

        if (!response.ok) {
          return [datasetId, datasetId] as const
        }

        const data = (await response.json()) as DashboardSecurableResponse
        const row = data.rows?.[0]
        const localizedName = localizeText(row?.name, '')
        return [datasetId, localizedName || datasetId] as const
      } catch {
        return [datasetId, datasetId] as const
      }
    }),
  )

  return Object.fromEntries(results)
}

export async function fetchDashboardPotentialMatches(
  dashboardId: string,
  dashboardName: string,
): Promise<PotentialMatch[]> {
  const payload = {
    action: 'get',
    version: '0.1.0',
    key: LUZMO_AUTH_KEY,
    token: LUZMO_AUTH_TOKEN,
    find: {
      where: {
        id: dashboardId,
        type: 'dashboard',
      },
    },
  }

  const response = await fetch(
    `${LUZMO_API_HOST.replace(/\/$/, '')}/0.1.0/securable`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

  if (!response.ok) {
    throw new Error(`Failed to load dashboard contents (${response.status}).`)
  }

  const data = (await response.json()) as DashboardSecurableResponse
  const selectedDashboardRow = data.rows?.[0]

  if (!selectedDashboardRow?.contents?.views || selectedDashboardRow.contents.views.length === 0) {
    return []
  }

  const preferredView =
    selectedDashboardRow.contents.views.find(
      (view) => view.screenModus?.toLowerCase() === 'desktop',
    ) ?? selectedDashboardRow.contents.views[0]

  const rawItems = preferredView?.items ?? []
  const cards = rawItems
    .filter(isSwipableChartItem)
    .map((item, index) => {
      const rawSlots = preserveRawSlots(item.slots)
      const slots = normalizeSlots(rawSlots)
      const datasetId = inferDatasetId(slots)
      const options = isRecord(item.options)
        ? (item.options as Record<string, unknown>)
        : {}
      const fallbackTitle = `${humanizeVizType(item.type ?? 'chart')} ${index + 1}`
      const title = localizeText(options.title, fallbackTitle)

      return {
        id: `${dashboardId}-${item.id ?? index}`,
        renderMode: 'flex-config',
        useItemReference: false,
        sourceDashboardId: dashboardId,
        sourceItemId: item.id ?? `${dashboardId}-item-${index}`,
        title,
        chartType: humanizeVizType(item.type ?? 'chart'),
        vizType: item.type ?? 'bar-chart',
        datasetId,
        datasetName: datasetId,
        sourceDashboardName: dashboardName,
        rawSlots,
        slots,
        aiSummary: buildAiSummary(item.type ?? 'chart', slots),
        options,
      } satisfies PotentialMatch
    })

  const datasetIds = Array.from(
    new Set(
      cards
        .map((card) => card.datasetId)
        .filter((id) => id && id !== 'unknown-dataset'),
    ),
  )
  const datasetNamesById = await fetchDatasetNames(datasetIds)

  return cards.map((card) => ({
    ...card,
    datasetName:
      datasetNamesById[card.datasetId] ??
      (card.datasetId === 'unknown-dataset' ? 'Unknown dataset' : card.datasetId),
  }))
}

export async function fetchDatasetColumnContents(datasetId: string): Promise<VizSlotContent[]> {
  if (!datasetId || datasetId === 'unknown-dataset') {
    return []
  }

  let dataFieldColumns: VizSlotContent[] = []
  try {
    const datasets = await loadDataFieldsForDatasets([datasetId], {
      dataBrokerConfig: {
        apiUrl: LUZMO_API_HOST,
        authKey: LUZMO_AUTH_KEY,
        authToken: LUZMO_AUTH_TOKEN,
      },
    })
    const dataset = datasets.find((entry) => entry.id === datasetId) ?? datasets[0]
    dataFieldColumns = Array.isArray(dataset?.dataFields)
      ? dataset.dataFields.reduce<VizSlotContent[]>((acc, field) => {
          if (!isRecord(field)) {
            return acc
          }

          if (typeof field.columnId !== 'string' || field.columnId.trim().length === 0) {
            return acc
          }

          const columnId = field.columnId
          const fieldName = localizeText(field.name, columnId)
          const slotContent: VizSlotContent = {
            datasetId,
            columnId,
            label: {
              en: fieldName || columnId,
            },
          }

          if (typeof field.type === 'string') {
            slotContent.type = field.type
          }
          if (typeof field.subtype === 'string') {
            slotContent.subtype = field.subtype
          }
          if (typeof field.lowestLevel === 'number') {
            slotContent.lowestLevel = field.lowestLevel
          }
          if (typeof field.highestLevel === 'number') {
            slotContent.highestLevel = field.highestLevel
          }

          acc.push(slotContent)
          return acc
        }, [])
      : []
  } catch {
    // Fall back to direct API probing below.
  }

  const payload = {
    action: 'get',
    version: '0.1.0',
    key: LUZMO_AUTH_KEY,
    token: LUZMO_AUTH_TOKEN,
    find: {
      where: {
        id: datasetId,
        type: 'dataset',
      },
    },
  }

  try {
    const response = await fetch(`${LUZMO_API_HOST.replace(/\/$/, '')}/0.1.0/securable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as DashboardSecurableResponse
    const row = data.rows?.[0]
    const securableColumns = extractDatasetColumnContentsFromRow(row, datasetId)
    return dedupeSlotContentsByColumn([...dataFieldColumns, ...securableColumns])
  } catch {
    return dedupeSlotContentsByColumn(dataFieldColumns)
  }
}

export async function buildBoomerCsvCard({
  sourceDashboardId,
  sourceDashboardName,
  datasetId,
  datasetName,
  columnContents,
}: {
  sourceDashboardId: string
  sourceDashboardName: string
  datasetId: string
  datasetName: string
  columnContents: VizSlotContent[]
}): Promise<PotentialMatch> {
  let tableColumnsSlotName = 'columns'

  try {
    const slotsConfig = await getSlotsConfigByItemType('regular-table')
    if (Array.isArray(slotsConfig) && slotsConfig.length > 0) {
      const preferredSlot =
        slotsConfig.find((slot) => {
          const slotName =
            typeof slot?.name === 'string' ? slot.name.toLowerCase() : ''
          const slotLabel = localizeText(slot?.label, '').toLowerCase()
          return slotName.includes('column') || slotLabel.includes('column')
        }) ?? slotsConfig[0]

      if (typeof preferredSlot?.name === 'string' && preferredSlot.name.trim()) {
        tableColumnsSlotName = preferredSlot.name
      }
    }
  } catch {
    // Keep fallback slot name.
  }

  const rawSlots: VizSlot[] = [
    {
      name: tableColumnsSlotName,
      content: columnContents,
    },
  ]
  const slots = normalizeSlots(rawSlots)
  const now = Date.now()
  const normalizedDatasetName = datasetName?.trim() || 'Selected Dataset'

  return {
    id: `${sourceDashboardId}-boomer-csv-${datasetId}-${now}`,
    renderMode: 'flex-config',
    sourceDashboardId,
    sourceItemId: `boomer-csv-${datasetId}-${now}`,
    title: `${normalizedDatasetName} CSV Export Table`,
    chartType: humanizeVizType('regular-table'),
    vizType: 'regular-table',
    datasetId,
    datasetName: normalizedDatasetName,
    sourceDashboardName,
    rawSlots,
    slots,
    aiSummary:
      'Full table view with all available dataset columns for quick export and inspection.',
    options: {
      title: `${normalizedDatasetName} CSV Export Table`,
    },
  }
}
