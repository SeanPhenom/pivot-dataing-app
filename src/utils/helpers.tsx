import type { ReactNode } from 'react'
import type { SlotConfig } from '@luzmo/dashboard-contents-types/src/lib/shared/types/slots'
import type {
  OptionConfig,
  OptionsConfig,
} from '@luzmo/dashboard-contents-types/src/lib/shared/utils/options-config.types'
import type {
  VizSlotContent,
  VizSlot,
  PotentialMatch,
  SavedConnection,
  LuzmoGridItem,
  DashboardItemRaw,
  DashboardRowRaw,
  ChartSummaryState,
  MatchPersonaKey,
  ColumnTypeKey,
  VizItemElement,
} from '../types'
import {
  CONTROL_WIDGET_TYPE_KEYWORDS,
  EXCLUDED_ITEM_TYPES,
  BOOMER_PERSONA_PREFIX,
  CAVEMAN_PERSONA_PREFIX,
  BUSINESS_PERSONA_PREFIX,
  DATA_ENGINEER_PERSONA_PREFIX,
  AI_SUMMARY_MAX_ROWS,
  AI_SUMMARY_UNSUPPORTED_TYPE_KEYWORDS,
  REALISM_PERSONA_BASE_CHANCE,
  REALISM_MATCH_STRICTNESS,
  REALISM_MAX_MATCH_CHANCE,
  SAVED_CONNECTIONS_STORAGE_KEY,
  ACTIVE_CONNECTION_STORAGE_KEY,
  AISUMMARY_CACHE_TTL_MS,
  AISUMMARY_CACHE_PREFIX,
} from './constants'

export function renderColumnTypeIcon(type: ColumnTypeKey): ReactNode {
  if (type === 'hierarchy') {
    return (
      <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
          <circle cx="8" cy="3.2" r="1.4" />
          <circle cx="3" cy="12" r="1.4" />
          <circle cx="8" cy="12" r="1.4" />
          <circle cx="13" cy="12" r="1.4" />
          <path d="M8 4.6v3.5M3 10.2h10M8 8.1h0" />
        </g>
      </svg>
    )
  }

  if (type === 'datetime') {
    return (
      <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5">
          <rect x="2.5" y="3" width="11" height="10.5" rx="2" />
          <path d="M5 1.8v2.4M11 1.8v2.4M2.5 6.5h11" />
        </g>
      </svg>
    )
  }

  if (type === 'currency') {
    return <span className="text-[0.72rem] font-bold leading-none">$</span>
  }

  if (type === 'numeric') {
    return <span className="text-[0.72rem] font-bold leading-none">#</span>
  }

  return <span className="text-[0.68rem] font-bold leading-none">T</span>
}

export function clampChance(value: number): number {
  return Math.min(0.95, Math.max(0.1, value))
}

export function isFilterOrControlVizType(vizType: string): boolean {
  const normalized = vizType.trim().toLowerCase()
  return CONTROL_WIDGET_TYPE_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

export function getPersonaMatchKey(persona: string): MatchPersonaKey {
  const normalized = persona.trim().toLowerCase()
  if (normalized.startsWith(CAVEMAN_PERSONA_PREFIX)) {
    return 'caveman'
  }
  if (normalized.startsWith(BUSINESS_PERSONA_PREFIX)) {
    return 'business'
  }
  if (normalized.startsWith(DATA_ENGINEER_PERSONA_PREFIX)) {
    return 'data-engineer'
  }

  return 'other'
}

export function getChartTypeModifier(vizType: string): number {
  const normalized = vizType.trim().toLowerCase()

  if (normalized.includes('evolution-number')) {
    return 0.15
  }
  if (normalized.includes('number')) {
    return 0.2
  }
  if (normalized.includes('bar-chart')) {
    return 0.1
  }
  if (normalized.includes('column-chart')) {
    return 0.08
  }
  if (normalized.includes('line-chart')) {
    return 0.06
  }
  if (normalized.includes('donut') || normalized.includes('pie')) {
    return 0.05
  }
  if (normalized.includes('area')) {
    return 0.04
  }
  if (normalized.includes('scatter')) {
    return -0.05
  }
  if (normalized.includes('bubble')) {
    return -0.08
  }
  if (normalized.includes('table') || normalized.includes('regular-table')) {
    return -0.12
  }
  if (normalized.includes('pivot')) {
    return -0.15
  }
  if (normalized.includes('map') || normalized.includes('choropleth')) {
    return -0.1
  }
  if (normalized.includes('funnel') || normalized.includes('gauge')) {
    return -0.06
  }
  if (isFilterOrControlVizType(vizType)) {
    return -0.2
  }

  return 0
}

export function getPersonaAffinityModifier(persona: string, vizType: string): number {
  const normalized = vizType.trim().toLowerCase()
  const key = getPersonaMatchKey(persona)

  if (key === 'caveman') {
    if (normalized.includes('number') && !normalized.includes('evolution')) {
      return 0.2
    }
    if (normalized.includes('bar') || normalized.includes('column')) {
      return 0.1
    }
    if (
      normalized.includes('table') ||
      normalized.includes('scatter') ||
      normalized.includes('pivot')
    ) {
      return -0.15
    }
    return 0
  }

  if (key === 'business') {
    if (normalized.includes('bar') || normalized.includes('column')) {
      return 0.12
    }
    if (normalized.includes('line') || normalized.includes('evolution')) {
      return 0.1
    }
    if (normalized.includes('donut') || normalized.includes('pie')) {
      return 0.08
    }
    if (normalized.includes('table')) {
      return 0.05
    }
    if (normalized.includes('scatter') || normalized.includes('bubble')) {
      return -0.08
    }
    return 0
  }

  if (key === 'data-engineer') {
    if (normalized.includes('table') || normalized.includes('regular-table')) {
      return 0.15
    }
    if (normalized.includes('scatter') || normalized.includes('bubble')) {
      return 0.1
    }
    if (normalized.includes('line') || normalized.includes('evolution')) {
      return 0.08
    }
    if (normalized.includes('number') && !normalized.includes('evolution')) {
      return -0.1
    }
    return 0
  }

  return 0
}

export function calculateRealismMatchChance(persona: string, card: PotentialMatch): number {
  const personaKey = getPersonaMatchKey(persona)
  const baseChance = REALISM_PERSONA_BASE_CHANCE[personaKey]
  const chartModifier = getChartTypeModifier(card.vizType)
  const affinityModifier = getPersonaAffinityModifier(persona, card.vizType)

  const raw = baseChance + chartModifier + affinityModifier
  const adjusted =
    raw * REALISM_MATCH_STRICTNESS + (1 - REALISM_MATCH_STRICTNESS) * baseChance

  return clampChance(Math.min(adjusted, REALISM_MAX_MATCH_CHANCE))
}

export function loadSavedConnectionsFromStorage(): SavedConnection[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const serialized = window.localStorage.getItem(SAVED_CONNECTIONS_STORAGE_KEY)
    if (!serialized) {
      return []
    }

    const parsed: unknown = JSON.parse(serialized)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (entry): entry is SavedConnection =>
        isRecord(entry) &&
        typeof entry.id === 'string' &&
        Array.isArray(entry.potentialMatches),
    )
  } catch {
    return []
  }
}

export function loadActiveConnectionIdFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const stored = window.localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY)
    if (typeof stored === 'string' && stored.trim().length > 0) {
      return stored
    }
  } catch {
    // no-op
  }

  return null
}

export function getConnectionDisplayName(connection: SavedConnection): string {
  if (connection.name?.trim()) {
    return connection.name
  }

  if (connection.sourceDashboardName?.trim()) {
    return connection.sourceDashboardName
  }

  return `Connection ${connection.id.slice(-6)}`
}

export function createUniqueConnectionName(
  dashboardName: string,
  existingConnections: SavedConnection[],
): string {
  const baseName = dashboardName.trim() || 'Connection'
  const existingNames = new Set(
    existingConnections.map((connection) =>
      getConnectionDisplayName(connection).toLowerCase(),
    ),
  )

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  let counter = 2
  let candidateName = `${baseName} ${counter}`
  while (existingNames.has(candidateName.toLowerCase())) {
    counter += 1
    candidateName = `${baseName} ${counter}`
  }

  return candidateName
}

export function isBoomerPersona(persona: string): boolean {
  return persona.trim().toLowerCase().startsWith(BOOMER_PERSONA_PREFIX)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function localizeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value.trim() || fallback
  }

  if (!isRecord(value)) {
    return fallback
  }

  const candidates: unknown[] = [
    value.en,
    value.EN,
    value['en-US'],
    value['en-GB'],
    ...Object.values(value),
  ]

  const found = candidates.find(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
  )

  return found ?? fallback
}

export function humanizeVizType(vizType: string): string {
  return vizType
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

export function normalizeSlots(rawSlots: unknown): VizSlot[] {
  if (!Array.isArray(rawSlots)) {
    return []
  }

  return rawSlots
    .filter((slot): slot is Record<string, unknown> => isRecord(slot))
    .map((slot) => {
      const name = typeof slot.name === 'string' ? slot.name : 'slot'
      const rawContent = Array.isArray(slot.content) ? slot.content : []
      const content = rawContent
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => {
          const entryDatasetId =
            typeof entry.datasetId === 'string'
              ? entry.datasetId
              : typeof entry.set === 'string'
                ? entry.set
                : undefined
          const entryColumnId =
            typeof entry.columnId === 'string'
              ? entry.columnId
              : typeof entry.column === 'string'
                ? entry.column
                : undefined

          const normalizedEntry: VizSlotContent = {
            ...entry,
          }

          if (entryDatasetId !== undefined) {
            normalizedEntry.datasetId = entryDatasetId
          }
          if (entryColumnId !== undefined) {
            normalizedEntry.columnId = entryColumnId
          }

          return normalizedEntry
        })

      return { name, content }
    })
}

export function preserveRawSlots(rawSlots: unknown): VizSlot[] {
  if (!Array.isArray(rawSlots)) {
    return []
  }

  return rawSlots
    .filter((slot): slot is Record<string, unknown> => isRecord(slot))
    .map((slot) => {
      const name = typeof slot.name === 'string' ? slot.name : 'slot'
      const rawContent = Array.isArray(slot.content) ? slot.content : []
      const content = rawContent.filter(
        (entry): entry is VizSlotContent => isRecord(entry),
      )

      return { name, content }
    })
}

export function isHierarchySlotContent(content: VizSlotContent): boolean {
  const type = typeof content.type === 'string' ? content.type.toLowerCase() : ''
  if (type.includes('hierarchy')) {
    return true
  }

  const subtype =
    typeof content.subtype === 'string' ? content.subtype.toLowerCase() : ''
  if (subtype.includes('hierarchy')) {
    return true
  }

  if (typeof content.level === 'number' || typeof content.lowestLevel === 'number') {
    return true
  }

  return false
}

export function isHierarchyOrDatetimeSlotContent(content: VizSlotContent): boolean {
  if (isHierarchySlotContent(content)) {
    return true
  }

  const type = typeof content.type === 'string' ? content.type.toLowerCase() : ''
  const subtype =
    typeof content.subtype === 'string' ? content.subtype.toLowerCase() : ''
  const combined = `${type} ${subtype}`

  return (
    combined.includes('datetime') ||
    combined.includes('date') ||
    combined.includes('time') ||
    combined.includes('timestamp')
  )
}

export function getColumnTypeKey(content: VizSlotContent): ColumnTypeKey {
  const type = typeof content.type === 'string' ? content.type.toLowerCase() : ''
  const subtype =
    typeof content.subtype === 'string' ? content.subtype.toLowerCase() : ''
  const combined = `${type} ${subtype}`
  const hintText = `${slotValueLabel(content)} ${
    typeof content.columnId === 'string' ? content.columnId : ''
  }`.toLowerCase()

  if (combined.includes('hierarchy')) {
    return 'hierarchy'
  }
  if (
    combined.includes('datetime') ||
    combined.includes('date') ||
    combined.includes('time') ||
    combined.includes('timestamp')
  ) {
    return 'datetime'
  }
  if (combined.includes('currency') || combined.includes('money')) {
    return 'currency'
  }
  if (
    combined.includes('numeric') ||
    combined.includes('number') ||
    combined.includes('measure') ||
    combined.includes('decimal') ||
    combined.includes('double') ||
    combined.includes('float') ||
    combined.includes('int') ||
    combined.includes('percent') ||
    combined.includes('ratio')
  ) {
    return 'numeric'
  }
  if (
    combined.includes('string') ||
    combined.includes('text') ||
    combined.includes('boolean') ||
    combined.includes('bool')
  ) {
    return 'text'
  }

  if (
    hintText.includes('date') ||
    hintText.includes('time') ||
    hintText.includes('year') ||
    hintText.includes('month') ||
    hintText.includes('day')
  ) {
    return 'datetime'
  }
  if (
    hintText.includes('count') ||
    hintText.includes('total') ||
    hintText.includes('sum') ||
    hintText.includes('avg') ||
    hintText.includes('rate') ||
    hintText.includes('score') ||
    hintText.includes('percent') ||
    hintText.includes('pct') ||
    hintText.includes('ratio') ||
    hintText.includes('cost') ||
    hintText.includes('amount') ||
    hintText.includes('index') ||
    hintText.includes('velocity') ||
    hintText.includes('hours') ||
    hintText.includes('minutes') ||
    hintText.includes('seconds') ||
    hintText.includes('price') ||
    hintText.includes('revenue') ||
    hintText.includes('emission') ||
    hintText.includes('consumption')
  ) {
    return 'numeric'
  }
  if (
    hintText.includes('id') ||
    hintText.includes('name') ||
    hintText.includes('city') ||
    hintText.includes('country') ||
    hintText.includes('industry') ||
    hintText.includes('status') ||
    hintText.includes('segment') ||
    hintText.includes('category')
  ) {
    return 'hierarchy'
  }

  const hasExplicitTypeHints = combined.trim().length > 0
  if (
    !hasExplicitTypeHints &&
    (typeof content.level === 'number' || typeof content.lowestLevel === 'number')
  ) {
    return 'hierarchy'
  }

  return 'text'
}

export function isGroupBySlotName(slotName: string): boolean {
  const normalized = slotName.toLowerCase()
  const groupByIndicators = ['group', 'legend']

  return groupByIndicators.some((indicator) => normalized.includes(indicator))
}

export function isCategoryAxisSlotName(slotName: string): boolean {
  const normalized = slotName.toLowerCase().replace(/[\s_-]/g, '')
  return normalized === 'xaxis' || normalized === 'yaxis' || normalized === 'category'
}

export function applyBuilderSlotRestrictionsConfig(slotsConfig: SlotConfig[]): SlotConfig[] {
  return slotsConfig.map((slot) => {
    const name = typeof slot.name === 'string' ? slot.name.toLowerCase() : ''
    const label = localizeText(slot.label ?? '', '').toLowerCase()
    const isGroupBySlot =
      name.includes('legend') || name.includes('group') || label.includes('group by')
    const isCategoryAxisSlot =
      isCategoryAxisSlotName(name) || label.includes('category')

    if (isGroupBySlot) {
      return {
        ...slot,
        acceptableDataFieldTypes: ['hierarchy', 'array[hierarchy]'],
        acceptableColumnTypes: ['hierarchy', 'array[hierarchy]'],
      }
    }

    if (!isCategoryAxisSlot) {
      return slot
    }

    return {
      ...slot,
      acceptableDataFieldTypes: [
        'hierarchy',
        'array[hierarchy]',
        'datetime',
        'array[datetime]',
      ],
      acceptableColumnTypes: [
        'hierarchy',
        'array[hierarchy]',
        'datetime',
        'array[datetime]',
      ],
    }
  })
}

export function enforceBuilderSlotRestrictions(rawSlots: VizSlot[]): {
  slots: VizSlot[]
  removedCount: number
} {
  let removedCount = 0

  const slots = rawSlots.map((slot) => {
    const isGroupBySlot = isGroupBySlotName(slot.name)
    const isCategoryAxisSlot = isCategoryAxisSlotName(slot.name)

    if (!isGroupBySlot && !isCategoryAxisSlot) {
      return slot
    }

    const filteredContent = slot.content.filter((content) => {
      const isAllowed = isGroupBySlot
        ? isHierarchySlotContent(content)
        : isHierarchyOrDatetimeSlotContent(content)
      if (!isAllowed) {
        removedCount += 1
      }
      return isAllowed
    })

    return {
      ...slot,
      content: filteredContent,
    }
  })

  return { slots, removedCount }
}

export function slotValueLabel(content: VizSlotContent): string {
  const labelValue = content.label
  if (typeof labelValue === 'string' && labelValue.trim().length > 0) {
    return labelValue
  }
  if (isRecord(labelValue)) {
    const localizedLabel = localizeText(labelValue, '')
    if (localizedLabel) {
      return localizedLabel
    }
  }

  if (typeof content.columnId === 'string') {
    return content.columnId
  }

  if (typeof content.formulaId === 'string') {
    return content.formulaId
  }

  const fallback = Object.entries(content).find(([, value]) => typeof value === 'string')
  return fallback ? (fallback[1] as string) : 'value'
}

export function inferDatasetId(slots: VizSlot[]): string {
  for (const slot of slots) {
    for (const content of slot.content) {
      if (typeof content.datasetId === 'string') {
        return content.datasetId
      }
      if (typeof content.set === 'string') {
        return content.set
      }
    }
  }

  return 'unknown-dataset'
}

export function buildAiSummary(vizType: string, slots: VizSlot[]): string {
  const normalizedVizType = vizType.toLowerCase()
  if (
    CONTROL_WIDGET_TYPE_KEYWORDS.some((keyword) =>
      normalizedVizType.includes(keyword),
    )
  ) {
    const controlFields = Array.from(
      new Set(slots.flatMap((slot) => slot.content.map(slotValueLabel))),
    )
    const controlFieldsText = controlFields.length
      ? controlFields.slice(0, 3).join(', ')
      : 'available fields'

    return `This ${humanizeVizType(vizType)} is a control widget that filters the dashboard using ${controlFieldsText}.`
  }

  const measureCandidates = slots
    .filter((slot) => slot.name.toLowerCase().includes('measure'))
    .flatMap((slot) => slot.content.map(slotValueLabel))
  const dimensionCandidates = slots
    .filter((slot) => !slot.name.toLowerCase().includes('measure'))
    .flatMap((slot) => slot.content.map(slotValueLabel))

  const measureText = measureCandidates.length
    ? measureCandidates.slice(0, 2).join(' and ')
    : 'key metrics'
  const dimensionText = dimensionCandidates.length
    ? dimensionCandidates.slice(0, 2).join(' and ')
    : 'its primary dimensions'

  return `This ${humanizeVizType(vizType)} tracks ${measureText} across ${dimensionText} from the selected dashboard.`
}

function slotContentLabel(
  slotName: string,
  content: VizSlotContent,
  index: number,
): string {
  const labelValue = content.label
  if (typeof labelValue === 'string' && labelValue.trim()) {
    return labelValue
  }
  if (isRecord(labelValue)) {
    const localized = localizeText(labelValue, '')
    if (localized) {
      return localized
    }
  }

  if (typeof content.columnId === 'string') {
    return content.columnId
  }
  if (typeof content.formulaId === 'string') {
    return content.formulaId
  }

  return `${slotName}_${index + 1}`
}

export function hasColumnsInSlots(slots: VizSlot[]): boolean {
  return slots.some((slot) => Array.isArray(slot.content) && slot.content.length > 0)
}

export function extractColumnLabels(slots: VizSlot[]): string[] {
  const labels: string[] = []
  const dimensionSlotNames = new Set([
    'category',
    'x-axis',
    'row',
    'column',
    'hierarchy',
    'dimension',
  ])
  const measureSlotNames = new Set(['measure', 'y-axis', 'value', 'size'])

  const pushLabels = (slot: VizSlot) => {
    slot.content.forEach((item, index) => {
      labels.push(slotContentLabel(slot.name, item, index))
    })
  }

  slots
    .filter((slot) => dimensionSlotNames.has(slot.name))
    .forEach(pushLabels)
  slots
    .filter((slot) => measureSlotNames.has(slot.name))
    .forEach(pushLabels)
  slots
    .filter(
      (slot) =>
        !dimensionSlotNames.has(slot.name) && !measureSlotNames.has(slot.name),
    )
    .forEach(pushLabels)

  return labels
}

export function extractDisplayValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(extractDisplayValue).join(', ')
  }

  if (isRecord(value)) {
    const localizedLabel = localizeText(value.label, '')
    if (localizedLabel) {
      return localizedLabel
    }

    const localizedName = localizeText(value.name, '')
    if (localizedName) {
      return localizedName
    }

    if (
      value.value !== undefined &&
      (typeof value.value === 'string' ||
        typeof value.value === 'number' ||
        typeof value.value === 'boolean')
    ) {
      return value.value
    }

    if (typeof value.id === 'string' && value.id.trim()) {
      return value.id
    }

    return JSON.stringify(value)
  }

  return String(value)
}

export function getItemDataRows(itemData: unknown): unknown[] {
  if (Array.isArray(itemData)) {
    return itemData
  }

  if (isRecord(itemData) && Array.isArray(itemData.data)) {
    return itemData.data
  }

  return []
}

export function sanitizeFileName(value: string): string {
  const normalized = value
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()

  return normalized || 'pivot-data-export'
}

export function triggerCsvDownloadFromExportResult(result: string, fileName: string): void {
  if (typeof document === 'undefined') {
    return
  }

  const trimmedResult = result.trim()
  if (!trimmedResult) {
    return
  }

  const link = document.createElement('a')
  link.rel = 'noopener'

  const isLinkResult =
    trimmedResult.startsWith('data:') ||
    trimmedResult.startsWith('blob:') ||
    trimmedResult.startsWith('http://') ||
    trimmedResult.startsWith('https://')

  if (isLinkResult) {
    link.href = trimmedResult
  } else {
    const csvBlob = new Blob([trimmedResult], { type: 'text/csv;charset=utf-8;' })
    const blobUrl = URL.createObjectURL(csvBlob)
    link.href = blobUrl
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }

  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
}

export function waitForVizItemRender(viz: VizItemElement, timeoutMs = 9000): Promise<void> {
  try {
    const currentData = viz.getData?.()
    if (currentData !== undefined && currentData !== null) {
      return Promise.resolve()
    }
  } catch {
    // Continue waiting for a rendered event.
  }

  return new Promise((resolve, reject) => {
    const onRendered = () => {
      cleanup()
      resolve()
    }

    const onTimeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('The export widget did not finish rendering in time.'))
    }, timeoutMs)

    const cleanup = () => {
      window.clearTimeout(onTimeout)
      viz.removeEventListener('rendered', onRendered as EventListener)
    }

    viz.addEventListener('rendered', onRendered as EventListener)
  })
}

export function extractChartDataRows(
  itemData: unknown,
  slots: VizSlot[],
): Record<string, unknown>[] {
  const rows = getItemDataRows(itemData)
  if (rows.length === 0) {
    return []
  }

  const slotLabels = extractColumnLabels(slots)

  const transformed = rows
    .map((row): Record<string, unknown> | null => {
      if (Array.isArray(row)) {
        const obj: Record<string, unknown> = {}
        row.forEach((value, index) => {
          const label = slotLabels[index] ?? `value_${index + 1}`
          obj[label] = extractDisplayValue(value)
        })
        return obj
      }

      if (isRecord(row)) {
        return Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, extractDisplayValue(value)]),
        )
      }

      return null
    })
    .filter((row): row is Record<string, unknown> => row !== null)

  if (transformed.length <= AI_SUMMARY_MAX_ROWS) {
    return transformed
  }

  const step = Math.ceil(transformed.length / AI_SUMMARY_MAX_ROWS)
  return transformed.filter((_, index) => index % step === 0).slice(0, AI_SUMMARY_MAX_ROWS)
}

export function parseAiSummaryText(payload: unknown): string | null {
  const candidates: unknown[] = []

  if (isRecord(payload)) {
    candidates.push(payload.text, payload.summary)

    if (isRecord(payload.properties)) {
      candidates.push(payload.properties.text, payload.properties.summary)
    }

    if (isRecord(payload.data)) {
      candidates.push(payload.data.text, payload.data.summary)
    }
  }

  const firstText = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )

  return firstText ?? null
}

export function parseAiSummaryErrorText(payload: unknown): string | null {
  const candidates: unknown[] = []

  if (isRecord(payload)) {
    candidates.push(payload.error, payload.message)

    if (isRecord(payload.properties)) {
      candidates.push(payload.properties.error, payload.properties.message)
    }

    if (isRecord(payload.data)) {
      candidates.push(payload.data.error, payload.data.message)
    }
  }

  const firstText = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )

  return firstText ?? null
}

function shouldHidePaddingOption(key: unknown): boolean {
  if (typeof key !== 'string') {
    return false
  }

  const normalizedKey = key.trim().toLowerCase()
  if (!normalizedKey) {
    return false
  }

  return (
    normalizedKey === 'padding' ||
    normalizedKey.startsWith('padding.') ||
    normalizedKey.endsWith('.padding') ||
    normalizedKey.includes('.padding.')
  )
}

export function filterOutPaddingFromOptionsConfig(
  config: OptionsConfig | null | undefined,
): OptionsConfig | undefined {
  if (!Array.isArray(config)) {
    return undefined
  }

  const prune = (nodes: OptionsConfig): OptionsConfig =>
    nodes.reduce<OptionsConfig>((accumulator, node) => {
      if (!isRecord(node) || shouldHidePaddingOption(node.key)) {
        return accumulator
      }

      const nextNode: OptionConfig = { ...node }
      if (Array.isArray(node.children)) {
        const filteredChildren = prune(node.children as OptionsConfig)
        if (filteredChildren.length > 0) {
          nextNode.children = filteredChildren
        } else {
          delete nextNode.children
        }
      }

      accumulator.push(nextNode)
      return accumulator
    }, [])

  return prune(config)
}

export function parseAiSummaryStreamText(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (!isRecord(payload)) {
    return null
  }

  const candidates: unknown[] = [
    payload.delta,
    payload.chunk,
    payload.token,
    payload.text,
    payload.summary,
  ]

  if (isRecord(payload.data)) {
    candidates.push(
      payload.data.delta,
      payload.data.chunk,
      payload.data.token,
      payload.data.text,
      payload.data.summary,
    )
  }

  if (isRecord(payload.properties)) {
    candidates.push(
      payload.properties.delta,
      payload.properties.chunk,
      payload.properties.token,
      payload.properties.text,
      payload.properties.summary,
    )
  }

  const firstText = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )

  return firstText ?? null
}

export function isAiSummaryStreamDone(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false
  }

  if (payload.done === true || payload.finished === true || payload.complete === true) {
    return true
  }

  const status = typeof payload.status === 'string' ? payload.status.toLowerCase() : ''
  if (
    status === 'done' ||
    status === 'completed' ||
    status === 'complete' ||
    status === 'finished'
  ) {
    return true
  }

  const event = typeof payload.event === 'string' ? payload.event.toLowerCase() : ''
  return event === 'done'
}

export function mergeStreamSummaryText(previous: string, next: string): string {
  if (!previous) {
    return next
  }

  if (next.startsWith(previous)) {
    return next
  }

  if (previous.endsWith(next)) {
    return previous
  }

  return `${previous}${next}`
}

export function parseIqMessageErrorText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null
  }

  const candidates: unknown[] = [
    payload.error,
    payload.message,
    payload.detail,
    payload.description,
    payload.reason,
  ]

  if (isRecord(payload.data)) {
    candidates.push(
      payload.data.error,
      payload.data.message,
      payload.data.detail,
    )
  }

  if (isRecord(payload.properties)) {
    candidates.push(
      payload.properties.error,
      payload.properties.message,
    )
  }

  const firstText = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )

  return firstText ?? null
}

export function tryParseRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    const codeFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    const candidates = [trimmed, codeFenceMatch?.[1] ?? '']

    for (const candidateText of candidates) {
      if (!candidateText) {
        continue
      }

      let depth = 0
      let start = -1
      let inString = false
      let escapeNext = false

      for (let index = 0; index < candidateText.length; index += 1) {
        const character = candidateText[index]

        if (escapeNext) {
          escapeNext = false
          continue
        }

        if (character === '\\') {
          escapeNext = true
          continue
        }

        if (character === '"') {
          inString = !inString
          continue
        }

        if (inString) {
          continue
        }

        if (character === '{') {
          if (depth === 0) {
            start = index
          }
          depth += 1
          continue
        }

        if (character === '}') {
          if (depth > 0) {
            depth -= 1
            if (depth === 0 && start >= 0) {
              const objectSlice = candidateText.slice(start, index + 1)
              try {
                const parsedObject = JSON.parse(objectSlice) as unknown
                if (isRecord(parsedObject)) {
                  return parsedObject
                }
              } catch {
                // Continue scanning.
              }
              start = -1
            }
          }
        }
      }
    }

    return null
  }
}

export function findIqChartPayloadCandidate(
  payload: unknown,
  depth = 0,
): Record<string, unknown> | null {
  if (depth > 6) {
    return null
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nested = findIqChartPayloadCandidate(entry, depth + 1)
      if (nested) {
        return nested
      }
    }
    return null
  }

  const record = tryParseRecord(payload)
  if (!record) {
    return null
  }

  const hasTypeCandidate =
    typeof record.type === 'string' ||
    typeof record.chart_type === 'string' ||
    typeof record.item_type === 'string' ||
    typeof record.viz_type === 'string'
  const hasSlotsCandidate =
    Array.isArray(record.slots) ||
    Array.isArray(record.slot_content) ||
    Array.isArray(record.slotsContents) ||
    Array.isArray(record.slot_contents)

  if (hasTypeCandidate && hasSlotsCandidate) {
    return record
  }

  const prioritizedKeys = [
    'chart',
    'chart_json',
    'chartJson',
    'visualization',
    'visualisation',
    'result',
    'response',
    'payload',
    'data',
  ]

  for (const key of prioritizedKeys) {
    const nested = findIqChartPayloadCandidate(record[key], depth + 1)
    if (nested) {
      return nested
    }
  }

  for (const value of Object.values(record)) {
    const nested = findIqChartPayloadCandidate(value, depth + 1)
    if (nested) {
      return nested
    }
  }

  return null
}

export function parseIqGeneratedChartConfig(payload: unknown): {
  vizType: string
  rawSlots: VizSlot[]
  options: Record<string, unknown>
  title: string
} | null {
  const chartPayload = findIqChartPayloadCandidate(payload)
  if (!chartPayload) {
    return null
  }

  const vizTypeRaw =
    (typeof chartPayload.type === 'string' ? chartPayload.type : '') ||
    (typeof chartPayload.chart_type === 'string' ? chartPayload.chart_type : '') ||
    (typeof chartPayload.item_type === 'string' ? chartPayload.item_type : '') ||
    (typeof chartPayload.viz_type === 'string' ? chartPayload.viz_type : '')
  const vizType = vizTypeRaw.trim()
  if (!vizType) {
    return null
  }

  const rawSlots = preserveRawSlots(
    chartPayload.slots ??
      chartPayload.slot_content ??
      chartPayload.slotsContents ??
      chartPayload.slot_contents ??
      [],
  )
  const hasSlots = rawSlots.some(
    (slot) => Array.isArray(slot.content) && slot.content.length > 0,
  )
  if (!hasSlots) {
    return null
  }

  const parsedOptions =
    tryParseRecord(chartPayload.options) ??
    tryParseRecord(chartPayload.chart_options) ??
    tryParseRecord(chartPayload.item_options) ??
    {}

  const title =
    localizeText(
      parsedOptions.title ??
        chartPayload.title ??
        chartPayload.chart_title ??
        chartPayload.name,
      '',
    ) || `IQ ${humanizeVizType(vizType)}`

  return {
    vizType,
    rawSlots,
    options: parsedOptions,
    title,
  }
}

export function isSummarizableItemType(itemType: string): boolean {
  const normalized = itemType.toLowerCase()
  if (EXCLUDED_ITEM_TYPES.has(normalized)) {
    return false
  }

  return true
}

export function isAiSummaryUnsupportedType(itemType: string): boolean {
  const normalized = itemType.toLowerCase()
  return AI_SUMMARY_UNSUPPORTED_TYPE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  )
}

export function isSwipableChartItem(item: DashboardItemRaw): boolean {
  if (!item.type || typeof item.type !== 'string') {
    return false
  }

  if (!isSummarizableItemType(item.type)) {
    return false
  }

  return true
}

export function dedupeSlotContentsByColumn(
  slotContents: VizSlotContent[],
): VizSlotContent[] {
  const byColumn = new Map<string, VizSlotContent>()

  slotContents.forEach((entry) => {
    const normalizedDatasetId =
      typeof entry.datasetId === 'string'
        ? entry.datasetId
        : typeof entry.set === 'string'
          ? entry.set
          : ''
    const normalizedColumnId =
      typeof entry.columnId === 'string'
        ? entry.columnId
        : typeof entry.column === 'string'
          ? entry.column
          : ''

    if (!normalizedColumnId) {
      return
    }

    const key = `${normalizedDatasetId || 'dataset'}::${normalizedColumnId}`
    if (!byColumn.has(key)) {
      byColumn.set(key, {
        ...entry,
        datasetId: normalizedDatasetId || undefined,
        columnId: normalizedColumnId,
      })
    }
  })

  return Array.from(byColumn.values())
}

export function extractDatasetColumnContentsFromRow(
  row: DashboardRowRaw | undefined,
  datasetId: string,
): VizSlotContent[] {
  if (!row || !isRecord(row)) {
    return []
  }

  const rowRecord = row as Record<string, unknown>
  const contents = isRecord(rowRecord.contents)
    ? (rowRecord.contents as Record<string, unknown>)
    : null
  const collections: unknown[][] = []
  const maybePushColumns = (value: unknown) => {
    if (Array.isArray(value)) {
      collections.push(value)
    }
  }

  maybePushColumns(rowRecord.columns)
  if (contents) {
    maybePushColumns(contents.columns)

    if (isRecord(contents.dataset)) {
      maybePushColumns(contents.dataset.columns)
    }
    if (isRecord(contents.schema)) {
      maybePushColumns(contents.schema.columns)
    }
    if (isRecord(contents.metadata)) {
      maybePushColumns(contents.metadata.columns)
    }
    if (isRecord(contents.model)) {
      maybePushColumns(contents.model.columns)
    }
    if (isRecord(contents.data)) {
      maybePushColumns(contents.data.columns)
    }
  }

  const slotContents: VizSlotContent[] = collections
    .flat()
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const columnIdCandidate =
        typeof entry.id === 'string'
          ? entry.id
          : typeof entry.columnId === 'string'
            ? entry.columnId
            : typeof entry.column_id === 'string'
              ? entry.column_id
              : typeof entry.column === 'string'
                ? entry.column
                : ''
      if (!columnIdCandidate) {
        return null
      }

      const entryDatasetId =
        typeof entry.datasetId === 'string'
          ? entry.datasetId
          : typeof entry.set === 'string'
            ? entry.set
            : datasetId
      if (entryDatasetId && datasetId && entryDatasetId !== datasetId) {
        return null
      }

      const type =
        typeof entry.type === 'string'
          ? entry.type
          : typeof entry.columnType === 'string'
            ? entry.columnType
            : undefined
      const subtype =
        typeof entry.subtype === 'string'
          ? entry.subtype
          : typeof entry.columnSubtype === 'string'
            ? entry.columnSubtype
            : undefined
      const labelSource = entry.label ?? entry.name
      const localizedLabel = localizeText(labelSource, columnIdCandidate)

      const slotContent: VizSlotContent = {
        datasetId: entryDatasetId,
        columnId: columnIdCandidate,
        label: { en: localizedLabel || columnIdCandidate },
      }

      if (type) {
        slotContent.type = type
      }
      if (subtype) {
        slotContent.subtype = subtype
      }
      if (typeof entry.level === 'number') {
        slotContent.level = entry.level
      }
      if (typeof entry.lowestLevel === 'number') {
        slotContent.lowestLevel = entry.lowestLevel
      }

      return slotContent
    })
    .filter((entry): entry is VizSlotContent => Boolean(entry))

  return dedupeSlotContentsByColumn(slotContents)
}

export function extractDatasetColumnContentsFromCards(
  cards: PotentialMatch[],
  datasetId: string,
): VizSlotContent[] {
  if (!datasetId) {
    return []
  }

  const slotContents: VizSlotContent[] = []
  cards.forEach((card) => {
    card.rawSlots.forEach((slot) => {
      slot.content.forEach((entry) => {
        const entryDatasetId =
          typeof entry.datasetId === 'string'
            ? entry.datasetId
            : typeof entry.set === 'string'
              ? entry.set
              : ''
        const entryColumnId =
          typeof entry.columnId === 'string'
            ? entry.columnId
            : typeof entry.column === 'string'
              ? entry.column
              : ''

        if (!entryColumnId || entryDatasetId !== datasetId) {
          return
        }

        slotContents.push({
          ...entry,
          datasetId,
          columnId: entryColumnId,
          label:
            entry.label ??
            (typeof entry.name === 'string' ? { en: entry.name } : { en: entryColumnId }),
        })
      })
    })
  })

  return dedupeSlotContentsByColumn(slotContents)
}

export function toGridItems(cards: PotentialMatch[]): LuzmoGridItem[] {
  return cards.map((card, index) => {
    const row = Math.floor(index / 2) * 18
    const col = (index % 2) * 24

    return {
      id: card.id,
      type: card.vizType,
      options: card.options,
      slots: card.rawSlots,
      position: {
        col,
        row,
        sizeX: 24,
        sizeY: 18,
      },
    }
  })
}

export function createIdleChartSummaries(
  cards: PotentialMatch[],
): Record<string, ChartSummaryState> {
  const summaries: Record<string, ChartSummaryState> = {}

  cards.forEach((card) => {
    summaries[card.id] = {
      status: 'idle',
      text: '',
    }
  })

  return summaries
}

export function stripThemeFromOptions(options: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => key !== 'theme'),
  )
}

export function withPivotPreviewTheme(
  options: Record<string, unknown>,
  theme: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...options,
    theme,
  }
}

export function stripThemeFromCard(card: PotentialMatch): PotentialMatch {
  return {
    ...card,
    options: stripThemeFromOptions(card.options),
  }
}

export function sanitizeConnectionThemes(connection: SavedConnection): SavedConnection {
  return {
    ...connection,
    potentialMatches: connection.potentialMatches.map(stripThemeFromCard),
    matches: connection.matches.map(stripThemeFromCard),
    skippedCards: connection.skippedCards.map(stripThemeFromCard),
    dashboardGridItems: connection.dashboardGridItems.map((item) => ({
      ...item,
      options: stripThemeFromOptions(item.options),
    })),
  }
}

export function mergeGridItemsWithMatches(
  existingItems: LuzmoGridItem[],
  currentMatches: PotentialMatch[],
): LuzmoGridItem[] {
  const existingById = new Map(existingItems.map((item) => [item.id, item]))
  const newGridItems = toGridItems(currentMatches)
  const merged = newGridItems.map((newItem) => {
    const existing = existingById.get(newItem.id)
    if (!existing) {
      return newItem
    }

    return {
      ...newItem,
      position: existing.position,
      options: existing.options,
    }
  })

  return merged
}

export function areGridItemsEqual(a: LuzmoGridItem[], b: LuzmoGridItem[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((item, index) => JSON.stringify(item) === JSON.stringify(b[index]))
}

function isUserGeneratedItemId(sourceItemId: string): boolean {
  const id = sourceItemId.toLowerCase()
  return id.startsWith('ai-') || id.startsWith('boomer-csv-')
}

export function getAiSummaryCache(sourceItemId: string): string | null {
  if (isUserGeneratedItemId(sourceItemId)) {
    return null
  }

  try {
    const raw = localStorage.getItem(`${AISUMMARY_CACHE_PREFIX}${sourceItemId}`)
    if (!raw) {
      return null
    }

    const entry: unknown = JSON.parse(raw)
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('text' in entry) ||
      !('ts' in entry) ||
      typeof (entry as Record<string, unknown>).text !== 'string' ||
      typeof (entry as Record<string, unknown>).ts !== 'number'
    ) {
      return null
    }

    const { text, ts } = entry as { text: string; ts: number }
    if (Date.now() - ts > AISUMMARY_CACHE_TTL_MS) {
      localStorage.removeItem(`${AISUMMARY_CACHE_PREFIX}${sourceItemId}`)
      return null
    }

    return text.trim().length > 0 ? text : null
  } catch {
    return null
  }
}

export function formatInlineMarkdown(text: string): ReactNode[] {
  const tokens: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|"(.+?)"/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index))
    }

    if (match[1] != null) {
      tokens.push(<strong key={match.index}>{match[1]}</strong>)
    } else if (match[2] != null) {
      tokens.push(<em key={match.index}>{match[2]}</em>)
    } else if (match[3] != null) {
      tokens.push(<q key={match.index}>{match[3]}</q>)
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex))
  }

  return tokens
}

export function setAiSummaryCache(sourceItemId: string, text: string): void {
  if (isUserGeneratedItemId(sourceItemId)) {
    return
  }

  try {
    localStorage.setItem(
      `${AISUMMARY_CACHE_PREFIX}${sourceItemId}`,
      JSON.stringify({ text, ts: Date.now() }),
    )
  } catch {
    // localStorage full or unavailable
  }
}
