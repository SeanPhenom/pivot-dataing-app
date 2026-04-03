import { motion, useDragControls } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getOptionsConfigByItemType } from '@luzmo/dashboard-contents-types/src/lib/shared/utils/options-config'
import { getSlotsConfigByItemType } from '@luzmo/dashboard-contents-types'
import type { SlotConfig } from '@luzmo/dashboard-contents-types/src/lib/shared/types/slots'
import type { OptionsConfig } from '@luzmo/dashboard-contents-types/src/lib/shared/utils/options-config.types'
import type {
  Screen,
  SwipeDirection,
  SwipeFeedback,
  SwipeBucket,
  DashboardChoice,
  VizSlotContent,
  VizSlot,
  PotentialMatch,
  SavedConnection,
  ChartSummaryState,
  AiModalStage,
  CreateMatchMode,
  IqChatMessage,
  DashboardProbeElement,
  VizItemElement,
  SlotPickerPanelElement,
  ItemOptionPanelElement,
  LuzmoGridItem,
  LuzmoGridElement,
} from './types'
import {
  LUZMO_AUTH_KEY,
  LUZMO_AUTH_TOKEN,
  LUZMO_API_HOST,
  LUZMO_APP_SERVER,
  PERSONAS,
  PIVOT_THEME,
  DASHBOARD_EDIT_ITEM_ACTIONS_MENU,
  AISUMMARY_BUCKET_SIZE,
  AISUMMARY_BUCKET_REFILL,
  SWIPE_FEEDBACK_VISIBLE_MS,
  SWIPE_FEEDBACK_CLEAR_DELAY_MS,
  SWIPE_CARD_EXIT_MS,
  COLUMN_TYPE_BADGES,
  SAVED_CONNECTIONS_STORAGE_KEY,
  ACTIVE_CONNECTION_STORAGE_KEY,
} from './utils/constants'
import {
  isRecord,
  isBoomerPersona,
  localizeText,
  humanizeVizType,
  normalizeSlots,
  preserveRawSlots,
  inferDatasetId,
  buildAiSummary,
  slotValueLabel,
  getColumnTypeKey,
  renderColumnTypeIcon,
  loadSavedConnectionsFromStorage,
  loadActiveConnectionIdFromStorage,
  getConnectionDisplayName,
  createUniqueConnectionName,
  calculateRealismMatchChance,
  toGridItems,
  createIdleChartSummaries,
  stripThemeFromOptions,
  sanitizeConnectionThemes,
  mergeGridItemsWithMatches,
  areGridItemsEqual,
  applyBuilderSlotRestrictionsConfig,
  enforceBuilderSlotRestrictions,
  hasColumnsInSlots,
  extractChartDataRows,
  isSummarizableItemType,
  isAiSummaryUnsupportedType,
  parseAiSummaryText,
  parseAiSummaryErrorText,
  filterOutPaddingFromOptionsConfig,
  parseIqGeneratedChartConfig,
  parseIqMessageErrorText,
  sanitizeFileName,
  triggerCsvDownloadFromExportResult,
  waitForVizItemRender,
  extractDatasetColumnContentsFromCards,
  dedupeSlotContentsByColumn,
} from './utils/helpers'
import {
  fetchDashboardPotentialMatches,
  fetchDatasetColumnContents,
  buildBoomerCsvCard,
  consumeAiSummaryStream,
  waitWithAbort,
} from './utils/api'
import { FlexChartCard } from './components/FlexChartCard'
import { SwipeBucketButton } from './components/SwipeBucketButton'
import { MatchProfile } from './components/MatchProfile'

function App() {
  const dashboardProbeRef = useRef<DashboardProbeElement | null>(null)
  const csvExportVizRef = useRef<VizItemElement | null>(null)
  const gridRef = useRef<LuzmoGridElement | null>(null)
  const slotPickerPanelRef = useRef<SlotPickerPanelElement | null>(null)
  const itemOptionPanelRef = useRef<ItemOptionPanelElement | null>(null)
  const autosavePausedRef = useRef(false)
  const autosaveResumeTimerRef = useRef<number | null>(null)
  const hydratedConnectionIdRef = useRef<string | null>(null)
  const swipeFeedbackHideTimerRef = useRef<number | null>(null)
  const swipeFeedbackClearTimerRef = useRef<number | null>(null)
  const swipeAdvanceTimerRef = useRef<number | null>(null)
  const swipeExitTimerRef = useRef<number | null>(null)
  const swipeLockFailSafeTimerRef = useRef<number | null>(null)
  const swipeResolutionLockRef = useRef(false)
  const iqRequestAbortRef = useRef<AbortController | null>(null)
  const iqPromptTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [screen, setScreen] = useState<Screen>('profile')
  const [selectedPersona, setSelectedPersona] = useState('')
  const [realismModeEnabled, setRealismModeEnabled] = useState(false)
  const [dashboardOptions, setDashboardOptions] = useState<DashboardChoice[]>([])
  const [selectedDashboardId, setSelectedDashboardId] = useState('')
  const [dashboardsLoading, setDashboardsLoading] = useState(true)
  const [dashboardsError, setDashboardsError] = useState('')
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([])
  const [potentialMatchesLoading, setPotentialMatchesLoading] = useState(false)
  const [potentialMatchesError, setPotentialMatchesError] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [matches, setMatches] = useState<PotentialMatch[]>([])
  const [skippedCards, setSkippedCards] = useState<PotentialMatch[]>([])
  const [dashboardGridItems, setDashboardGridItems] = useState<LuzmoGridItem[]>([])
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>(
    () => loadSavedConnectionsFromStorage(),
  )
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    () => loadActiveConnectionIdFromStorage(),
  )
  const [isDashboardLayoutEditing, setIsDashboardLayoutEditing] = useState(false)
  const [openBucket, setOpenBucket] = useState<SwipeBucket | null>(null)
  const [autosaveResumeSignal, setAutosaveResumeSignal] = useState(0)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiModalStage, setAiModalStage] = useState<AiModalStage>('entry')
  const [createMatchMode, setCreateMatchMode] = useState<CreateMatchMode>('builder')
  const [showConnectionsModal, setShowConnectionsModal] = useState(false)
  const [editingDashboardItem, setEditingDashboardItem] = useState<{
    id: string
    type: string
    options: Record<string, unknown>
    slots: VizSlot[]
  } | null>(null)
  const [itemEditorOptionsConfig, setItemEditorOptionsConfig] =
    useState<OptionsConfig>()
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null)
  const [editingConnectionName, setEditingConnectionName] = useState('')
  const [builderChartType, setBuilderChartType] = useState('')
  const [builderSlotsConfig, setBuilderSlotsConfig] = useState<SlotConfig[]>([])
  const [builderSlotsContents, setBuilderSlotsContents] = useState<VizSlot[]>([])
  const [builderSelectedDatasetId, setBuilderSelectedDatasetId] = useState('')
  const [builderError, setBuilderError] = useState('')
  const [iqPrompt, setIqPrompt] = useState('')
  const [iqChatMessages, setIqChatMessages] = useState<IqChatMessage[]>([])
  const [iqGeneratedCard, setIqGeneratedCard] = useState<PotentialMatch | null>(null)
  const [iqLoading, setIqLoading] = useState(false)
  const [iqError, setIqError] = useState('')
  const [iqSaveMessage, setIqSaveMessage] = useState('')
  const [aiColumnsByDatasetId, setAiColumnsByDatasetId] = useState<
    Record<string, VizSlotContent[]>
  >({})
  const [aiColumnsLoading, setAiColumnsLoading] = useState(false)
  const [aiColumnsError, setAiColumnsError] = useState('')
  const builderSlotPanelKey = useMemo(() => {
    const mode = builderSlotsConfig.length > 0 ? 'custom' : 'auto'
    return `${builderChartType || 'unset'}-${mode}`
  }, [builderChartType, builderSlotsConfig.length])
  const [chartSummaries, setChartSummaries] = useState<Record<string, ChartSummaryState>>({})
  const chartSummariesRef = useRef<Record<string, ChartSummaryState>>({})
  const summaryInFlightRef = useRef<Set<string>>(new Set())
  const summaryAbortRef = useRef<Map<string, AbortController>>(new Map())
  const summaryQueueRef = useRef<Promise<void>>(Promise.resolve())
  const summaryTokensRef = useRef(AISUMMARY_BUCKET_SIZE)
  const summaryTokensUpdatedRef = useRef(Date.now())
  const topCardResizeObserverRef = useRef<ResizeObserver | null>(null)
  const topCardResizeRafRef = useRef<number | null>(null)
  const [discoverStackHeight, setDiscoverStackHeight] = useState(760)
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeFeedback>(null)
  const [showSwipeFeedback, setShowSwipeFeedback] = useState(false)
  const discoverDragControls = useDragControls()
  const [swipeInProgress, setSwipeInProgress] = useState<{
    cardId: string
    direction: SwipeDirection
  } | null>(null)
  const [csvExportInProgress, setCsvExportInProgress] = useState(false)
  const [csvExportStatus, setCsvExportStatus] = useState<{
    tone: 'idle' | 'success' | 'error'
    message: string
  }>({
    tone: 'idle',
    message: '',
  })
  const moveMatchedCardToSkipped = useCallback(
    (cardId: string) => {
      const normalizedCardId = cardId.trim()
      if (!normalizedCardId) {
        return
      }

      const deletedCard = matches.find((card) => card.id === normalizedCardId)
      if (!deletedCard) {
        return
      }

      setMatches((previous) =>
        previous.filter((card) => card.id !== normalizedCardId),
      )
      setSkippedCards((previous) => {
        if (previous.some((card) => card.id === normalizedCardId)) {
          return previous
        }
        return [...previous, deletedCard]
      })
      setDashboardGridItems((previous) =>
        previous.filter((item) => item.id !== normalizedCardId),
      )
      setEditingDashboardItem((current) =>
        current && current.id === normalizedCardId ? null : current,
      )
    },
    [matches],
  )
  const closeDashboardItemEditor = useCallback(() => {
    setEditingDashboardItem((current) => {
      if (!current) {
        return null
      }

      void gridRef.current?.triggerItemAction?.(current.id, 'item-options', {
        active: false,
      })
      return null
    })
  }, [])
  const triggerSwipeFeedback = useCallback((nextFeedback: Exclude<SwipeFeedback, null>) => {
    if (swipeFeedbackHideTimerRef.current !== null) {
      window.clearTimeout(swipeFeedbackHideTimerRef.current)
      swipeFeedbackHideTimerRef.current = null
    }
    if (swipeFeedbackClearTimerRef.current !== null) {
      window.clearTimeout(swipeFeedbackClearTimerRef.current)
      swipeFeedbackClearTimerRef.current = null
    }

    setSwipeFeedback(nextFeedback)
    setShowSwipeFeedback(true)
    swipeFeedbackHideTimerRef.current = window.setTimeout(() => {
      setShowSwipeFeedback(false)
      swipeFeedbackHideTimerRef.current = null
    }, SWIPE_FEEDBACK_VISIBLE_MS)
    swipeFeedbackClearTimerRef.current = window.setTimeout(() => {
      setSwipeFeedback(null)
      swipeFeedbackClearTimerRef.current = null
    }, SWIPE_FEEDBACK_CLEAR_DELAY_MS)
  }, [])
  const updateDashboardItemOptions = useCallback(
    (itemId: string, nextOptions: Record<string, unknown>) => {
      const sanitizedOptions = stripThemeFromOptions(nextOptions)
      setEditingDashboardItem((current) =>
        current && current.id === itemId
          ? { ...current, options: sanitizedOptions }
          : current,
      )
      setDashboardGridItems((previous) =>
        previous.map((item) =>
          item.id === itemId ? { ...item, options: sanitizedOptions } : item,
        ),
      )
      setMatches((previous) =>
        previous.map((card) =>
          card.id === itemId
            ? {
                ...card,
                options: sanitizedOptions,
                title: localizeText(sanitizedOptions.title, card.title),
              }
            : card,
        ),
      )
    },
    [],
  )
  const editingDashboardTitle = useMemo(() => {
    if (!editingDashboardItem) {
      return ''
    }

    const titleFromOptions = localizeText(editingDashboardItem.options?.title, '')
    if (titleFromOptions.trim()) {
      return titleFromOptions
    }

    return (
      matches.find((card) => card.id === editingDashboardItem.id)?.title ?? ''
    )
  }, [editingDashboardItem, matches])
  const handleDashboardTitleChange = useCallback(
    (nextTitle: string) => {
      if (!editingDashboardItem) {
        return
      }

      const currentTitleOption = editingDashboardItem.options?.title
      const nextTitleOption = isRecord(currentTitleOption)
        ? { ...currentTitleOption, en: nextTitle }
        : { en: nextTitle }

      updateDashboardItemOptions(editingDashboardItem.id, {
        ...editingDashboardItem.options,
        title: nextTitleOption,
      })
    },
    [editingDashboardItem, updateDashboardItemOptions],
  )

  const selectedDashboard = useMemo(
    () => dashboardOptions.find((dashboard) => dashboard.id === selectedDashboardId),
    [dashboardOptions, selectedDashboardId],
  )
  const activeConnection = useMemo(
    () =>
      savedConnections.find((connection) => connection.id === activeConnectionId) ?? null,
    [savedConnections, activeConnectionId],
  )
  const activeConnectionName = useMemo(
    () => (activeConnection ? getConnectionDisplayName(activeConnection) : ''),
    [activeConnection],
  )
  const connectionsCount = savedConnections.length
  const savedConnectionsByDashboardId = useMemo(() => {
    const counts: Record<string, number> = {}
    savedConnections.forEach((connection) => {
      const dashboardId = connection.sourceDashboardId
      if (!dashboardId) {
        return
      }
      counts[dashboardId] = (counts[dashboardId] ?? 0) + 1
    })
    return counts
  }, [savedConnections])
  const activeDashboardName = useMemo(() => {
    if (activeConnection?.sourceDashboardName) {
      return activeConnection.sourceDashboardName
    }

    if (matches[0]?.sourceDashboardName) {
      return matches[0].sourceDashboardName
    }

    if (potentialMatches[0]?.sourceDashboardName) {
      return potentialMatches[0].sourceDashboardName
    }

    return selectedDashboard?.name ?? ''
  }, [activeConnection, matches, potentialMatches, selectedDashboard])
  const activeCsvExportCard = useMemo(() => {
    const boomerCsvCard = matches.find((card) => {
      const isRegularTable = card.vizType === 'regular-table'
      const sourceItemId = card.sourceItemId?.toLowerCase?.() ?? ''
      return isRegularTable && sourceItemId.startsWith('boomer-csv-')
    })

    if (boomerCsvCard) {
      return boomerCsvCard
    }

    return matches.find((card) => card.vizType === 'regular-table') ?? null
  }, [matches])
  const activeBoomerCsvCard = useMemo(
    () =>
      matches.find((card) => {
        const sourceItemId = card.sourceItemId?.toLowerCase?.() ?? ''
        return card.vizType === 'regular-table' && sourceItemId.startsWith('boomer-csv-')
      }) ?? null,
    [matches],
  )
  const activeCsvExportGridItem = useMemo(() => {
    if (!activeCsvExportCard) {
      return null
    }

    return (
      dashboardGridItems.find((item) => item.id === activeCsvExportCard.id) ?? null
    )
  }, [dashboardGridItems, activeCsvExportCard])
  const canExportCsv = Boolean(activeCsvExportCard)
  const shouldShowCsvExport = isBoomerPersona(activeConnection?.persona ?? '')
  const datasetNameById = useMemo(() => {
    const map: Record<string, string> = {}

    ;[...potentialMatches, ...matches].forEach((card) => {
      const datasetId = card.datasetId?.trim()
      if (!datasetId || datasetId === 'unknown-dataset') {
        return
      }

      if (!map[datasetId]) {
        map[datasetId] = card.datasetName?.trim() || datasetId
      }
    })

    return map
  }, [potentialMatches, matches])
  const builderChartTypeOptions = useMemo(() => {
    const discoveredTypes = Array.from(
      new Set(
        [...potentialMatches, ...matches]
          .map((card) => card.vizType)
          .filter((type) => typeof type === 'string' && type.trim().length > 0),
      ),
    )

    const requiredTypes = [
      'bar-chart',
      'column-chart',
      'conditional-number',
      'evolution-number',
    ]
    const fallbackTypes = ['line-chart', 'scatter-plot']

    return Array.from(
      new Set([...requiredTypes, ...discoveredTypes, ...fallbackTypes]),
    )
  }, [potentialMatches, matches])
  const builderDatasetIds = useMemo(
    () => Object.keys(datasetNameById),
    [datasetNameById],
  )
  const aiPromptDatasetId = useMemo(
    () =>
      builderSelectedDatasetId ||
      builderDatasetIds[0] ||
      potentialMatches.find((card) => card.datasetId !== 'unknown-dataset')?.datasetId ||
      matches.find((card) => card.datasetId !== 'unknown-dataset')?.datasetId ||
      '',
    [builderDatasetIds, builderSelectedDatasetId, matches, potentialMatches],
  )
  const aiPromptDatasetName = useMemo(
    () =>
      datasetNameById[aiPromptDatasetId] ||
      potentialMatches.find((card) => card.datasetId === aiPromptDatasetId)?.datasetName ||
      matches.find((card) => card.datasetId === aiPromptDatasetId)?.datasetName ||
      selectedDashboard?.name ||
      activeDashboardName ||
      'Selected data',
    [
      activeDashboardName,
      aiPromptDatasetId,
      datasetNameById,
      matches,
      potentialMatches,
      selectedDashboard,
    ],
  )
  const aiAvailableColumns = useMemo(
    () =>
      aiPromptDatasetId
        ? [...(aiColumnsByDatasetId[aiPromptDatasetId] ?? [])].sort((left, right) =>
            slotValueLabel(left).localeCompare(slotValueLabel(right)),
          )
        : [],
    [aiColumnsByDatasetId, aiPromptDatasetId],
  )

  const topCard = potentialMatches[currentIndex]
  const remainingCards = potentialMatches.slice(currentIndex, currentIndex + 3)
  const allCardsSwiped =
    potentialMatches.length > 0 && currentIndex >= potentialMatches.length
  const isBuilderModalActive =
    showAiModal && aiModalStage === 'create' && createMatchMode === 'builder'
  const canStart = Boolean(selectedPersona && selectedDashboardId)
  const isBoomerSelected = isBoomerPersona(selectedPersona)
  const isRealismActive = realismModeEnabled && !isBoomerSelected
  const stageOrder: Screen[] = ['profile', 'discover', 'dashboard']
  const currentStageIndex = stageOrder.indexOf(screen)
  const canOpenDiscoverTab =
    screen !== 'profile' &&
    !(
      potentialMatches.length === 0 &&
      !potentialMatchesLoading
    )
  const canOpenDashboardTab = connectionsCount > 0

  const handleTopCardMount = useCallback((node: HTMLElement | null) => {
    if (topCardResizeRafRef.current !== null) {
      window.cancelAnimationFrame(topCardResizeRafRef.current)
      topCardResizeRafRef.current = null
    }

    if (topCardResizeObserverRef.current) {
      topCardResizeObserverRef.current.disconnect()
      topCardResizeObserverRef.current = null
    }

    if (!node) {
      return
    }

    const updateHeight = () => {
      const measuredHeight = node.offsetHeight
      const nextHeight = Math.max(760, Math.ceil(measuredHeight + 36))
      setDiscoverStackHeight((previous) => {
        // Avoid shrinking between swipes, which can force-scroll users upward.
        if (nextHeight <= previous) {
          return previous
        }
        return Math.abs(previous - nextHeight) > 12 ? nextHeight : previous
      })
    }

    updateHeight()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (topCardResizeRafRef.current !== null) {
          window.cancelAnimationFrame(topCardResizeRafRef.current)
        }
        topCardResizeRafRef.current = window.requestAnimationFrame(() => {
          topCardResizeRafRef.current = null
          updateHeight()
        })
      })
      observer.observe(node)
      topCardResizeObserverRef.current = observer
    }
  }, [])

  const getStepState = (step: Screen) => {
    const stepIndex = stageOrder.indexOf(step)
    return {
      isCurrent: screen === step,
      isCompleted: stepIndex < currentStageIndex,
    }
  }

  const getStepClassName = (
    state: ReturnType<typeof getStepState>,
    isDisabled: boolean,
  ) => {
    if (state.isCurrent) {
      return 'border-2 border-teal-600 bg-teal-600 text-white shadow-[0_0_0_4px_rgba(20,184,166,0.18)]'
    }

    if (state.isCompleted) {
      return 'border-slate-300 bg-white text-slate-900'
    }

    if (isDisabled) {
      return 'border-slate-200 bg-slate-100 text-slate-400'
    }

    return 'border-slate-300 bg-slate-100 text-slate-500'
  }

  const scheduleAutosaveResume = useCallback(() => {
    if (autosaveResumeTimerRef.current !== null) {
      window.clearTimeout(autosaveResumeTimerRef.current)
    }

    autosaveResumeTimerRef.current = window.setTimeout(() => {
      autosavePausedRef.current = false
      autosaveResumeTimerRef.current = null
      setAutosaveResumeSignal((previous) => previous + 1)
    }, 0)
  }, [])

  const pauseAutosave = useCallback(() => {
    autosavePausedRef.current = true
    if (autosaveResumeTimerRef.current !== null) {
      window.clearTimeout(autosaveResumeTimerRef.current)
      autosaveResumeTimerRef.current = null
    }
  }, [])

  const applyConnectionToWorkspace = useCallback(
    (connection: SavedConnection) => {
      const sanitizedConnection = sanitizeConnectionThemes(connection)
      pauseAutosave()

      summaryAbortRef.current.forEach((controller) => controller.abort())
      summaryAbortRef.current.clear()
      summaryInFlightRef.current.clear()
      summaryQueueRef.current = Promise.resolve()
      summaryTokensRef.current = AISUMMARY_BUCKET_SIZE
      summaryTokensUpdatedRef.current = Date.now()

      setSelectedPersona(sanitizedConnection.persona)
      setRealismModeEnabled(Boolean(sanitizedConnection.realismMode))
      setSelectedDashboardId(sanitizedConnection.sourceDashboardId)
      setPotentialMatches(sanitizedConnection.potentialMatches)
      setPotentialMatchesLoading(false)
      setPotentialMatchesError('')
      setCurrentIndex(
        Math.min(
          Math.max(sanitizedConnection.currentIndex, 0),
          sanitizedConnection.potentialMatches.length,
        ),
      )
      setMatches(sanitizedConnection.matches)
      setSkippedCards(sanitizedConnection.skippedCards)
      setDashboardGridItems(
        mergeGridItemsWithMatches(
          sanitizedConnection.dashboardGridItems ?? [],
          sanitizedConnection.matches,
        ),
      )
      setChartSummaries(createIdleChartSummaries(sanitizedConnection.potentialMatches))
      setIsDashboardLayoutEditing(false)
      setShowAiModal(false)
      setOpenBucket(null)

      scheduleAutosaveResume()
    },
    [pauseAutosave, scheduleAutosaveResume],
  )

  useEffect(() => {
    const probe = dashboardProbeRef.current
    if (!probe) {
      return
    }

    probe.authKey = LUZMO_AUTH_KEY
    probe.authToken = LUZMO_AUTH_TOKEN
  }, [])

  useEffect(() => {
    const probe = dashboardProbeRef.current
    if (!probe || !probe.getAccessibleDashboards) {
      setDashboardsError('Dashboard discovery component is unavailable.')
      setDashboardsLoading(false)
      return
    }

    let isCancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const dashboards = await probe.getAccessibleDashboards?.()
        if (isCancelled || !dashboards) {
          return
        }

        const mapped = dashboards
          .filter((dashboard) => dashboard.id && dashboard.name)
          .map((dashboard) => ({
            id: dashboard.id as string,
            name: dashboard.name as string,
          }))

        setDashboardOptions(mapped)
        if (mapped.length === 0) {
          setDashboardsError('No dashboards are available for this token.')
        }
      } catch {
        if (!isCancelled) {
          setDashboardsError(
            'Could not load dashboards from the token. Please verify the key/token permissions.',
          )
        }
      } finally {
        if (!isCancelled) {
          setDashboardsLoading(false)
        }
      }
    }, 400)

    return () => {
      isCancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (savedConnections.length === 0) {
      if (activeConnectionId !== null) {
        setActiveConnectionId(null)
      }
      return
    }

    if (
      !activeConnectionId ||
      !savedConnections.some((connection) => connection.id === activeConnectionId)
    ) {
      setActiveConnectionId(savedConnections[0].id)
    }
  }, [savedConnections, activeConnectionId])

  useEffect(() => {
    if (!activeConnectionId) {
      hydratedConnectionIdRef.current = null
      return
    }

    if (hydratedConnectionIdRef.current === activeConnectionId) {
      return
    }

    const connection = savedConnections.find(
      (entry) => entry.id === activeConnectionId,
    )
    if (!connection) {
      return
    }

    hydratedConnectionIdRef.current = activeConnectionId
    applyConnectionToWorkspace(connection)
  }, [activeConnectionId, savedConnections, applyConnectionToWorkspace])

  useEffect(() => {
    return () => {
      if (swipeFeedbackHideTimerRef.current !== null) {
        window.clearTimeout(swipeFeedbackHideTimerRef.current)
        swipeFeedbackHideTimerRef.current = null
      }
      if (swipeFeedbackClearTimerRef.current !== null) {
        window.clearTimeout(swipeFeedbackClearTimerRef.current)
        swipeFeedbackClearTimerRef.current = null
      }
      if (swipeAdvanceTimerRef.current !== null) {
        window.clearTimeout(swipeAdvanceTimerRef.current)
        swipeAdvanceTimerRef.current = null
      }
      if (swipeExitTimerRef.current !== null) {
        window.clearTimeout(swipeExitTimerRef.current)
        swipeExitTimerRef.current = null
      }
      if (swipeLockFailSafeTimerRef.current !== null) {
        window.clearTimeout(swipeLockFailSafeTimerRef.current)
        swipeLockFailSafeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    setDashboardGridItems((previous) => {
      const merged = mergeGridItemsWithMatches(previous, matches)
      return areGridItemsEqual(previous, merged) ? previous : merged
    })
  }, [matches])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || screen !== 'dashboard') {
      return
    }

    grid.authKey = LUZMO_AUTH_KEY
    grid.authToken = LUZMO_AUTH_TOKEN
    grid.appServer = LUZMO_APP_SERVER
    grid.apiHost = LUZMO_API_HOST
    grid.theme = PIVOT_THEME
    grid.language = 'en'
    grid.contentLanguage = 'en'
    grid.columns = 48
    grid.rowHeight = 16
    grid.viewMode = !isDashboardLayoutEditing
    grid.defaultItemActionsMenu = DASHBOARD_EDIT_ITEM_ACTIONS_MENU
    if (isDashboardLayoutEditing) {
      grid.removeAttribute('view-mode')
    } else {
      grid.setAttribute('view-mode', '')
    }
    grid.items = dashboardGridItems
  }, [dashboardGridItems, screen, isDashboardLayoutEditing])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || screen !== 'dashboard') {
      return
    }

    const handleGridChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail
      const detailUpdatedItems = isRecord(detail) ? detail.updatedItems : undefined
      const detailItems = isRecord(detail) ? detail.items : undefined
      const candidateItems = Array.isArray(detailUpdatedItems)
        ? (detailUpdatedItems as LuzmoGridItem[])
        : Array.isArray(detailItems)
          ? (detailItems as LuzmoGridItem[])
          : Array.isArray(grid.items)
            ? (grid.items as LuzmoGridItem[])
            : []

      if (candidateItems.length === 0) {
        return
      }

      setDashboardGridItems((previous) => {
        const merged = mergeGridItemsWithMatches(candidateItems, matches)
        return areGridItemsEqual(previous, merged) ? previous : merged
      })
    }

    grid.addEventListener('luzmo-item-grid-changed', handleGridChanged)
    grid.addEventListener('luzmo-item-grid-layout-changed', handleGridChanged)
    return () => {
      grid.removeEventListener('luzmo-item-grid-changed', handleGridChanged)
      grid.removeEventListener('luzmo-item-grid-layout-changed', handleGridChanged)
    }
  }, [screen, matches])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || screen !== 'dashboard') {
      return
    }

    const handleGridItemAction = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!isRecord(detail)) {
        return
      }

      const action =
        typeof detail.action === 'string' ? detail.action.trim().toLowerCase() : ''
      const detailItem = isRecord(detail.item) ? detail.item : null

      if (action === 'delete') {
        const deletedId =
          typeof detail.deletedId === 'string' && detail.deletedId.trim().length > 0
            ? detail.deletedId
            : typeof detailItem?.id === 'string' && detailItem.id.trim().length > 0
              ? detailItem.id
            : typeof detail.id === 'string'
              ? detail.id
              : ''
        moveMatchedCardToSkipped(deletedId)
        return
      }

      if (action !== 'item-options') {
        return
      }

      const isActive = typeof detail.active === 'boolean' ? detail.active : true
      if (!isActive) {
        // Ignore passive "inactive" toggles from the grid action stream.
        // The drawer is closed explicitly via close button/backdrop/delete.
        return
      }

      const itemId =
        typeof detailItem?.id === 'string' && detailItem.id.trim().length > 0
          ? detailItem.id
          : typeof detail.id === 'string'
            ? detail.id
            : ''
      if (!itemId) {
        return
      }

      const itemFromState = dashboardGridItems.find((item) => item.id === itemId)
      const itemType =
        typeof detailItem?.type === 'string'
          ? detailItem.type
          : typeof detail.type === 'string'
          ? detail.type
          : itemFromState?.type ?? ''
      if (!itemType) {
        return
      }

      const itemOptions = isRecord(detailItem?.options)
        ? stripThemeFromOptions(detailItem.options as Record<string, unknown>)
        : isRecord(detail.options)
          ? stripThemeFromOptions(detail.options as Record<string, unknown>)
        : stripThemeFromOptions(itemFromState?.options ?? {})
      const itemSlots = Array.isArray(detailItem?.slots)
        ? preserveRawSlots(detailItem.slots)
        : Array.isArray(detail.slots)
          ? preserveRawSlots(detail.slots)
        : itemFromState?.slots ?? []

      setEditingDashboardItem({
        id: itemId,
        type: itemType,
        options: itemOptions,
        slots: itemSlots,
      })
    }

    grid.addEventListener('luzmo-item-grid-item-action', handleGridItemAction)
    return () => {
      grid.removeEventListener('luzmo-item-grid-item-action', handleGridItemAction)
    }
  }, [screen, dashboardGridItems, moveMatchedCardToSkipped])

  useEffect(() => {
    if (screen !== 'dashboard' || !isDashboardLayoutEditing) {
      setEditingDashboardItem(null)
    }
  }, [screen, isDashboardLayoutEditing])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const bodyClassName = 'pivot-edit-drawer-open'

    if (editingDashboardItem) {
      document.body.classList.add(bodyClassName)
      const grid = gridRef.current
      try {
        grid?.deactivateItems?.()
      } catch {
        // no-op
      }
      if (editingDashboardItem.id) {
        void grid?.triggerItemAction?.(editingDashboardItem.id, 'item-options', {
          active: false,
        })
      }
    } else {
      document.body.classList.remove(bodyClassName)
    }

    return () => {
      document.body.classList.remove(bodyClassName)
    }
  }, [editingDashboardItem])

  useEffect(() => {
    if (!editingDashboardItem) {
      setItemEditorOptionsConfig(undefined)
      return
    }

    let isCancelled = false
    const loadItemOptionsConfig = async () => {
      try {
        const optionsConfig = await getOptionsConfigByItemType(
          editingDashboardItem.type,
        )
        if (isCancelled) {
          return
        }
        setItemEditorOptionsConfig(filterOutPaddingFromOptionsConfig(optionsConfig))
      } catch {
        if (!isCancelled) {
          setItemEditorOptionsConfig(undefined)
        }
      }
    }

    void loadItemOptionsConfig()
    return () => {
      isCancelled = true
    }
  }, [editingDashboardItem])

  useEffect(() => {
    const panel = itemOptionPanelRef.current
    if (!panel || !editingDashboardItem) {
      return
    }

    panel.language = 'en'
    panel.itemType = editingDashboardItem.type
    panel.options = editingDashboardItem.options
    panel.slots = editingDashboardItem.slots
    const hasCustomOptionsConfig =
      Array.isArray(itemEditorOptionsConfig) &&
      itemEditorOptionsConfig.length > 0
    if (hasCustomOptionsConfig) {
      panel.customOptionsConfiguration = itemEditorOptionsConfig
    } else {
      // Explicitly clear custom mode so ACK falls back to built-in options.
      panel.customOptionsConfiguration = undefined
      panel.removeAttribute('custom-options-configuration')
    }
    panel.apiUrl = LUZMO_API_HOST
    panel.authKey = LUZMO_AUTH_KEY
    panel.authToken = LUZMO_AUTH_TOKEN
    panel.size = 'm'
  }, [editingDashboardItem, itemEditorOptionsConfig])

  useEffect(() => {
    const panel = itemOptionPanelRef.current
    if (!panel || !editingDashboardItem) {
      return
    }

    const itemId = editingDashboardItem.id
    const handleOptionsChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!isRecord(detail) || !isRecord(detail.options)) {
        return
      }

      const nextOptions = detail.options as Record<string, unknown>
      updateDashboardItemOptions(itemId, nextOptions)
    }

    panel.addEventListener('luzmo-options-changed', handleOptionsChanged)
    return () => {
      panel.removeEventListener('luzmo-options-changed', handleOptionsChanged)
    }
  }, [editingDashboardItem, updateDashboardItemOptions])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(
        SAVED_CONNECTIONS_STORAGE_KEY,
        JSON.stringify(savedConnections),
      )
    } catch {
      // no-op
    }
  }, [savedConnections])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      if (!activeConnectionId) {
        window.localStorage.removeItem(ACTIVE_CONNECTION_STORAGE_KEY)
      } else {
        window.localStorage.setItem(ACTIVE_CONNECTION_STORAGE_KEY, activeConnectionId)
      }
    } catch {
      // no-op
    }
  }, [activeConnectionId])

  useEffect(() => {
    if (!activeConnectionId || autosavePausedRef.current) {
      return
    }

    setSavedConnections((previous) => {
      let hasUpdated = false

      const nextConnections = previous.map((connection) => {
        if (connection.id !== activeConnectionId) {
          return connection
        }

        hasUpdated = true
        const sourceDashboardName =
          selectedDashboard?.name ||
          potentialMatches[0]?.sourceDashboardName ||
          matches[0]?.sourceDashboardName ||
          connection.sourceDashboardName

        const nextConnection: SavedConnection = {
          ...connection,
          name: connection.name?.trim()
            ? connection.name
            : sourceDashboardName || connection.name,
          sourceDashboardId: connection.sourceDashboardId,
          sourceDashboardName: connection.sourceDashboardName || sourceDashboardName,
          persona: connection.persona,
          realismMode: Boolean(connection.realismMode),
          potentialMatches,
          currentIndex,
          matches,
          skippedCards,
          dashboardGridItems: mergeGridItemsWithMatches(dashboardGridItems, matches),
          updatedAt: new Date().toISOString(),
        }

        return nextConnection
      })

      return hasUpdated ? nextConnections : previous
    })
  }, [
    activeConnectionId,
    autosaveResumeSignal,
    currentIndex,
    dashboardGridItems,
    matches,
    potentialMatches,
    selectedDashboard,
    selectedDashboardId,
    selectedPersona,
    skippedCards,
  ])

  useEffect(() => {
    if (screen === 'discover' && allCardsSwiped && !potentialMatchesLoading) {
      setAiModalStage('entry')
      setCreateMatchMode('builder')
      setIqPrompt('')
      setIqChatMessages([])
      setIqGeneratedCard(null)
      setIqLoading(false)
      setIqError('')
      setIqSaveMessage('')
      setShowAiModal(true)
    }
  }, [allCardsSwiped, potentialMatchesLoading, screen])

  useEffect(() => {
    if (screen !== 'discover' && showAiModal) {
      setShowAiModal(false)
    }
  }, [screen, showAiModal])

  useEffect(() => {
    if (screen !== 'discover') {
      setDiscoverStackHeight(760)
    }
  }, [screen])

  useEffect(() => {
    if (showAiModal) {
      return
    }

    iqRequestAbortRef.current?.abort()
    iqRequestAbortRef.current = null
    setIqLoading(false)
  }, [showAiModal])

  useEffect(() => {
    const csvViz = csvExportVizRef.current
    if (!csvViz) {
      return
    }

    if (screen !== 'dashboard' || !activeCsvExportCard) {
      csvViz.removeAttribute('type')
      csvViz.removeAttribute('options')
      csvViz.removeAttribute('slots')
      csvViz.removeAttribute('dashboardId')
      csvViz.removeAttribute('itemId')
      return
    }

    const sourceItemId = activeCsvExportCard.sourceItemId?.toLowerCase?.() ?? ''
    const useItemReference =
      activeCsvExportCard.useItemReference ?? !sourceItemId.startsWith('ai-')
    const supportsItemReference =
      useItemReference &&
      !sourceItemId.startsWith('boomer-csv-') &&
      Boolean(activeCsvExportCard.sourceDashboardId)
    const exportOptions = activeCsvExportGridItem?.options ?? activeCsvExportCard.options ?? {}
    const exportSlots =
      activeCsvExportGridItem?.slots ?? activeCsvExportCard.rawSlots ?? []

    csvViz.authKey = LUZMO_AUTH_KEY
    csvViz.authToken = LUZMO_AUTH_TOKEN
    csvViz.appServer = LUZMO_APP_SERVER
    csvViz.apiHost = LUZMO_API_HOST
    csvViz.type = activeCsvExportCard.vizType
    csvViz.options = exportOptions
    csvViz.slots = exportSlots

    csvViz.setAttribute('authKey', LUZMO_AUTH_KEY)
    csvViz.setAttribute('authToken', LUZMO_AUTH_TOKEN)
    csvViz.setAttribute('appServer', LUZMO_APP_SERVER)
    csvViz.setAttribute('apiHost', LUZMO_API_HOST)
    csvViz.setAttribute('type', activeCsvExportCard.vizType)
    csvViz.setAttribute('options', JSON.stringify(exportOptions))
    csvViz.setAttribute('slots', JSON.stringify(exportSlots))

    if (supportsItemReference && activeCsvExportCard.sourceDashboardId) {
      csvViz.dashboardId = activeCsvExportCard.sourceDashboardId
      csvViz.itemId = activeCsvExportCard.sourceItemId
      csvViz.setAttribute('dashboardId', activeCsvExportCard.sourceDashboardId)
      csvViz.setAttribute('itemId', activeCsvExportCard.sourceItemId)
    } else {
      csvViz.dashboardId = undefined
      csvViz.itemId = undefined
      csvViz.removeAttribute('dashboardId')
      csvViz.removeAttribute('itemId')
    }
  }, [screen, activeCsvExportCard, activeCsvExportGridItem])

  useEffect(() => {
    if (!activeBoomerCsvCard) {
      return
    }

    let isCancelled = false
    const syncBoomerTableColumns = async () => {
      const datasetId = activeBoomerCsvCard.datasetId
      if (!datasetId || datasetId === 'unknown-dataset') {
        return
      }

      const fullDatasetColumns = await fetchDatasetColumnContents(datasetId)
      if (isCancelled || fullDatasetColumns.length === 0) {
        return
      }

      const currentColumnIds = new Set(
        activeBoomerCsvCard.rawSlots
          .flatMap((slot) => slot.content)
          .map((content) =>
            typeof content.columnId === 'string' ? content.columnId : '',
          )
          .filter((columnId) => columnId.length > 0),
      )
      const nextColumnIds = new Set(
        fullDatasetColumns
          .map((content) =>
            typeof content.columnId === 'string' ? content.columnId : '',
          )
          .filter((columnId) => columnId.length > 0),
      )

      const hasSameColumns =
        currentColumnIds.size === nextColumnIds.size &&
        Array.from(nextColumnIds).every((columnId) => currentColumnIds.has(columnId))
      if (hasSameColumns) {
        return
      }

      const slotName =
        activeBoomerCsvCard.rawSlots[0]?.name ||
        activeBoomerCsvCard.slots[0]?.name ||
        'columns'
      const nextRawSlots: VizSlot[] = [
        {
          name: slotName,
          content: fullDatasetColumns,
        },
      ]
      const nextSlots = normalizeSlots(nextRawSlots)

      setMatches((previous) =>
        previous.map((card) =>
          card.id === activeBoomerCsvCard.id
            ? {
                ...card,
                rawSlots: nextRawSlots,
                slots: nextSlots,
              }
            : card,
        ),
      )
      setDashboardGridItems((previous) =>
        previous.map((item) =>
          item.id === activeBoomerCsvCard.id ? { ...item, slots: nextSlots } : item,
        ),
      )
    }

    void syncBoomerTableColumns()
    return () => {
      isCancelled = true
    }
  }, [activeBoomerCsvCard])

  const handleCsvExport = useCallback(async () => {
    if (!activeCsvExportCard) {
      setCsvExportStatus({
        tone: 'error',
        message: 'No table is available for CSV export in this connection yet.',
      })
      return
    }

    const csvViz = csvExportVizRef.current
    if (!csvViz || typeof csvViz.export !== 'function') {
      setCsvExportStatus({
        tone: 'error',
        message: 'CSV export is unavailable right now. Please refresh and try again.',
      })
      return
    }

    setCsvExportInProgress(true)
    setCsvExportStatus({ tone: 'idle', message: '' })

    try {
      await waitForVizItemRender(csvViz)
      const exportResult = await csvViz.export('csv')
      if (typeof exportResult === 'string' && exportResult.trim()) {
        const baseName = sanitizeFileName(
          activeConnectionName ||
            activeDashboardName ||
            activeCsvExportCard.datasetName ||
            'pivot-data-export',
        )
        triggerCsvDownloadFromExportResult(exportResult, `${baseName}.csv`)
      }

      setCsvExportStatus({
        tone: 'success',
        message: 'CSV export started. Your download should begin automatically.',
      })
    } catch {
      setCsvExportStatus({
        tone: 'error',
        message: 'CSV export failed for this table. Please try again.',
      })
    } finally {
      setCsvExportInProgress(false)
    }
  }, [activeCsvExportCard, activeConnectionName, activeDashboardName])

  useEffect(() => {
    if (!isBuilderModalActive) {
      return
    }

    setBuilderError('')
    setBuilderSlotsConfig([])
    setBuilderSlotsContents([])
    setBuilderChartType((previous) => previous || builderChartTypeOptions[0] || 'bar-chart')
    setBuilderSelectedDatasetId(
      (previous) => previous || builderDatasetIds[0] || potentialMatches[0]?.datasetId || '',
    )
  }, [
    isBuilderModalActive,
    builderChartTypeOptions,
    builderDatasetIds,
    potentialMatches,
  ])

  useEffect(() => {
    if (!isBuilderModalActive) {
      return
    }

    let isCancelled = false
    const currentItemType = builderChartType || builderChartTypeOptions[0] || 'bar-chart'

    const loadSlotsConfig = async () => {
      try {
        const loadedConfig = await getSlotsConfigByItemType(currentItemType)
        if (isCancelled) {
          return
        }

        const nextConfig = Array.isArray(loadedConfig)
          ? applyBuilderSlotRestrictionsConfig(loadedConfig as SlotConfig[])
          : []
        setBuilderSlotsConfig(nextConfig)
      } catch {
        if (!isCancelled) {
          setBuilderSlotsConfig([])
        }
      }
    }

    loadSlotsConfig()

    return () => {
      isCancelled = true
    }
  }, [isBuilderModalActive, builderChartType, builderChartTypeOptions])

  useEffect(() => {
    const panel = slotPickerPanelRef.current
    if (!panel || !isBuilderModalActive) {
      return
    }

    if (builderSlotsConfig.length > 0) {
      panel.itemType = ''
      panel.removeAttribute('item-type')
    } else {
      panel.itemType = builderChartType || builderChartTypeOptions[0] || 'bar-chart'
    }
    panel.slotsConfiguration = builderSlotsConfig
    panel.slotsContents = builderSlotsContents
    panel.datasetIds = builderDatasetIds
    panel.selectedDatasetId =
      builderSelectedDatasetId || builderDatasetIds[0] || undefined
    panel.datasetPicker = builderDatasetIds.length > 1
    panel.apiUrl = LUZMO_API_HOST
    panel.authKey = LUZMO_AUTH_KEY
    panel.authToken = LUZMO_AUTH_TOKEN
    panel.contentLanguage = 'en'
    panel.selects = 'single'
    panel.grows = true
  }, [
    isBuilderModalActive,
    builderChartType,
    builderChartTypeOptions,
    builderSlotsConfig,
    builderSlotsContents,
    builderDatasetIds,
    builderSelectedDatasetId,
  ])

  useEffect(() => {
    const panel = slotPickerPanelRef.current
    if (!panel || !isBuilderModalActive) {
      return
    }

    const handleSlotsChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (isRecord(detail) && Array.isArray(detail.slotsContents)) {
        const normalizedSlots = preserveRawSlots(detail.slotsContents)
        const {
          slots: hierarchyFilteredSlots,
          removedCount,
        } = enforceBuilderSlotRestrictions(normalizedSlots)

        setBuilderSlotsContents(hierarchyFilteredSlots)
        if (removedCount > 0) {
          setBuilderError(
            'Group-by accepts hierarchy only. Category, x-axis, and y-axis accept hierarchy or datetime only.',
          )
        } else if (builderError) {
          setBuilderError('')
        }
      }
    }

    const handleDatasetChanged = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (isRecord(detail) && typeof detail.datasetId === 'string') {
        setBuilderSelectedDatasetId(detail.datasetId)
      }
    }

    panel.addEventListener('luzmo-slots-contents-changed', handleSlotsChanged)
    panel.addEventListener('luzmo-dataset-changed', handleDatasetChanged)

    return () => {
      panel.removeEventListener('luzmo-slots-contents-changed', handleSlotsChanged)
      panel.removeEventListener('luzmo-dataset-changed', handleDatasetChanged)
    }
  }, [isBuilderModalActive, builderError])

  useEffect(() => {
    chartSummariesRef.current = chartSummaries
  }, [chartSummaries])

  useEffect(() => {
    if (screen !== 'discover') {
      setOpenBucket(null)
    }
  }, [screen])

  useEffect(
    () => () => {
      summaryAbortRef.current.forEach((controller) => controller.abort())
      summaryAbortRef.current.clear()
      summaryInFlightRef.current.clear()
      summaryQueueRef.current = Promise.resolve()
      summaryTokensRef.current = AISUMMARY_BUCKET_SIZE
      summaryTokensUpdatedRef.current = Date.now()
      if (topCardResizeRafRef.current !== null) {
        window.cancelAnimationFrame(topCardResizeRafRef.current)
        topCardResizeRafRef.current = null
      }
      topCardResizeObserverRef.current?.disconnect()
      topCardResizeObserverRef.current = null
      if (autosaveResumeTimerRef.current !== null) {
        window.clearTimeout(autosaveResumeTimerRef.current)
        autosaveResumeTimerRef.current = null
      }
      iqRequestAbortRef.current?.abort()
      iqRequestAbortRef.current = null
    },
    [],
  )

  function getSummaryTokenWaitMs(): number {
    const now = Date.now()
    const elapsed = (now - summaryTokensUpdatedRef.current) / 1000
    const tokens = Math.min(
      AISUMMARY_BUCKET_SIZE,
      summaryTokensRef.current + elapsed * AISUMMARY_BUCKET_REFILL,
    )
    if (tokens >= 1) return 0
    return Math.ceil(((1 - tokens) / AISUMMARY_BUCKET_REFILL) * 1000)
  }

  function consumeSummaryToken(): void {
    const now = Date.now()
    const elapsed = (now - summaryTokensUpdatedRef.current) / 1000
    summaryTokensRef.current =
      Math.min(
        AISUMMARY_BUCKET_SIZE,
        summaryTokensRef.current + elapsed * AISUMMARY_BUCKET_REFILL,
      ) - 1
    summaryTokensUpdatedRef.current = now
  }

  const summarizeCardWithAiSummary = async (
    card: PotentialMatch,
    itemData: unknown,
  ) => {
    let controller: AbortController | null = null

    try {
      if (!isSummarizableItemType(card.vizType)) {
        setChartSummaries((previous) => ({
          ...previous,
          [card.id]: {
            status: 'ready',
            text: 'AI summary is not applicable for this widget type.',
          },
        }))
        return
      }

      if (!hasColumnsInSlots(card.rawSlots)) {
        setChartSummaries((previous) => ({
          ...previous,
          [card.id]: {
            status: 'ready',
            text: 'Add data to the chart to generate an AI summary.',
          },
        }))
        return
      }

      if (isAiSummaryUnsupportedType(card.vizType)) {
        setChartSummaries((previous) => ({
          ...previous,
          [card.id]: {
            status: 'ready',
            text: buildAiSummary(card.vizType, card.slots),
          },
        }))
        return
      }

      const chartData = extractChartDataRows(itemData, card.rawSlots)
      if (chartData.length === 0) {
        setChartSummaries((previous) => ({
          ...previous,
          [card.id]: {
            status: 'idle',
            text: '',
          },
        }))
        return
      }

      const payload = {
        version: '0.1.0',
        action: 'create',
        key: LUZMO_AUTH_KEY,
        token: LUZMO_AUTH_TOKEN,
        properties: {
          type: 'chart',
          action: 'generate',
          dashboard_id: card.sourceDashboardId ?? selectedDashboardId,
          chart_id: card.sourceItemId,
          chart_type: card.vizType,
          chart_title: card.title,
          locale: 'en',
          stream: true,
          custom_prompt:
            'NEVER use Markdown formatting in the summary. NEVER mention the chart title in the summary. Limit the summary to 100 words. Highlight correlations if you can.',
          chart_data: chartData,
          slot_content: card.rawSlots,
        },
      }

      controller = new AbortController()
      summaryAbortRef.current.set(card.id, controller)

      const tokenWaitMs = getSummaryTokenWaitMs()
      if (tokenWaitMs > 0) {
        await waitWithAbort(controller.signal, tokenWaitMs)
      }
      consumeSummaryToken()

      const maxAttempts = 3
      const retryDelayMs = [500, 1200]
      let lastErrorMessage = 'AI summary unavailable for this widget.'

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const response = await fetch(
          `${LUZMO_API_HOST.replace(/\/$/, '')}/0.1.0/aisummary`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          },
        )

        const contentType = response.headers.get('content-type') ?? ''
        const isJsonResponse = contentType.includes('application/json')

        if (response.ok && payload.properties.stream && response.body && !isJsonResponse) {
          let partialTextBuffer = ''
          let partialFlushTimer: ReturnType<typeof window.setTimeout> | null = null
          const flushPartial = () => {
            if (!partialTextBuffer) {
              return
            }
            setChartSummaries((previous) => ({
              ...previous,
              [card.id]: {
                status: 'loading',
                text: partialTextBuffer,
              },
            }))
          }

          const streamed = await consumeAiSummaryStream(
            response.body,
            controller.signal,
            (partialText) => {
              partialTextBuffer = partialText
              if (partialFlushTimer !== null) {
                return
              }
              partialFlushTimer = window.setTimeout(() => {
                partialFlushTimer = null
                flushPartial()
              }, 120)
            },
          )

          if (partialFlushTimer !== null) {
            window.clearTimeout(partialFlushTimer)
            partialFlushTimer = null
          }
          flushPartial()

          const streamedText = streamed.text
          if (typeof streamedText === 'string' && streamedText.trim().length > 0) {
            setChartSummaries((previous) => ({
              ...previous,
              [card.id]: {
                status: 'ready',
                text: streamedText,
              },
            }))
            return
          }

          lastErrorMessage =
            streamed.error ?? 'AI summary API stream returned no summary text.'
        } else {
          let bodyPayload: unknown = null
          let bodyText = ''

          if (isJsonResponse) {
            bodyPayload = await response.json().catch(() => null)
          } else {
            bodyText = await response.text().catch(() => '')
          }

          const apiErrorText =
            parseAiSummaryErrorText(bodyPayload) ??
            (bodyText.trim().length > 0 ? bodyText.trim() : null)

          if (response.ok) {
            const summaryText = parseAiSummaryText(bodyPayload)
            if (summaryText) {
              setChartSummaries((previous) => ({
                ...previous,
                [card.id]: {
                  status: 'ready',
                  text: summaryText,
                },
              }))
              return
            }

            lastErrorMessage = apiErrorText ?? 'AI summary API returned no summary text.'
          } else {
            lastErrorMessage =
              apiErrorText ??
              `AI summary request failed (${response.status}).`

            const isRetryable = response.status === 429 || response.status >= 500
            if (!isRetryable) {
              break
            }

            if (response.status === 429) {
              summaryTokensRef.current = 0
              summaryTokensUpdatedRef.current = Date.now()
            }

            if (attempt < maxAttempts) {
              const delay = response.status === 429
                ? Math.ceil(1000 / AISUMMARY_BUCKET_REFILL)
                : (retryDelayMs[attempt - 1] ?? retryDelayMs[retryDelayMs.length - 1])
              await waitWithAbort(controller.signal, delay)
              continue
            }
          }
        }

        if (!response.ok) {
          lastErrorMessage =
            lastErrorMessage ||
            `AI summary request failed (${response.status}).`
          break
        }

        if (attempt < maxAttempts) {
          await waitWithAbort(
            controller.signal,
            retryDelayMs[attempt - 1] ?? retryDelayMs[retryDelayMs.length - 1],
          )
          continue
        }
      }

      setChartSummaries((previous) => ({
        ...previous,
        [card.id]: {
          status: 'error',
          text: lastErrorMessage,
        },
      }))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'AI summary unavailable for this widget.'

      setChartSummaries((previous) => ({
        ...previous,
        [card.id]: {
          status: 'error',
          text: message,
        },
      }))
    } finally {
      if (controller) {
        summaryAbortRef.current.delete(card.id)
      }
      summaryInFlightRef.current.delete(card.id)
    }
  }

  const handleCardDataReady = (cardId: string, itemData: unknown) => {
    const card = potentialMatches.find((entry) => entry.id === cardId)
    if (!card) {
      return
    }

    const currentStatus = chartSummariesRef.current[cardId]?.status
    if (
      currentStatus === 'ready' ||
      currentStatus === 'loading' ||
      summaryInFlightRef.current.has(cardId)
    ) {
      return
    }

    summaryInFlightRef.current.add(cardId)
    setChartSummaries((previous) => ({
      ...previous,
      [cardId]: {
        status: 'loading',
        text: '',
      },
    }))

    summaryQueueRef.current = summaryQueueRef.current
      .catch(() => undefined)
      .then(() => summarizeCardWithAiSummary(card, itemData))
      .catch(() => undefined)
  }

  const handleStartDashboardFlow = async () => {
    if (!canStart) {
      return
    }

    const shouldOpenDashboardDirectly = isBoomerPersona(selectedPersona)

    pauseAutosave()
    summaryAbortRef.current.forEach((controller) => controller.abort())
    summaryAbortRef.current.clear()
    summaryInFlightRef.current.clear()
    summaryQueueRef.current = Promise.resolve()
    summaryTokensRef.current = AISUMMARY_BUCKET_SIZE
    summaryTokensUpdatedRef.current = Date.now()
    setShowAiModal(false)
    setPotentialMatchesLoading(true)
    setPotentialMatchesError('')
    setPotentialMatches([])
    setChartSummaries({})
    setCurrentIndex(0)
    setIsDashboardLayoutEditing(false)
    setOpenBucket(null)
    setScreen('discover')

    try {
      const dashboardName = selectedDashboard?.name ?? 'Selected Dashboard'
      const cards = await fetchDashboardPotentialMatches(
        selectedDashboardId,
        dashboardName,
      )

      if (cards.length === 0) {
        setPotentialMatchesError(
          'No chart cards were found in this dashboard. Please choose another dashboard.',
        )
        return
      }

      let initialMatches: PotentialMatch[] = []
      let initialGridItems: LuzmoGridItem[] = []

      if (shouldOpenDashboardDirectly) {
        const primaryDatasetId =
          cards.find((card) => card.datasetId && card.datasetId !== 'unknown-dataset')
            ?.datasetId ?? ''

        if (primaryDatasetId) {
          const datasetName =
            cards.find((card) => card.datasetId === primaryDatasetId)?.datasetName ??
            primaryDatasetId

          let datasetColumns = await fetchDatasetColumnContents(primaryDatasetId)
          if (datasetColumns.length === 0) {
            datasetColumns = extractDatasetColumnContentsFromCards(
              cards,
              primaryDatasetId,
            )
          }

          if (datasetColumns.length > 0) {
            const boomerCsvCard = await buildBoomerCsvCard({
              sourceDashboardId: selectedDashboardId,
              sourceDashboardName: dashboardName,
              datasetId: primaryDatasetId,
              datasetName,
              columnContents: datasetColumns,
            })

            initialMatches = [boomerCsvCard]
            initialGridItems = toGridItems(initialMatches).map((item) => ({
              ...item,
              position: {
                col: 0,
                row: 0,
                sizeX: 48,
                sizeY: 32,
              },
            }))
          }
        }
      }

      if (shouldOpenDashboardDirectly && initialMatches.length === 0) {
        setPotentialMatchesError(
          'Could not build the CSV export table from this selected data connection.',
        )
        return
      }

      const now = new Date().toISOString()
      const connectionId = `connection-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`
      const initialConnection: SavedConnection = {
        id: connectionId,
        name: createUniqueConnectionName(dashboardName, savedConnections),
        sourceDashboardId: selectedDashboardId,
        sourceDashboardName: dashboardName,
        persona: selectedPersona,
        realismMode: shouldOpenDashboardDirectly ? false : realismModeEnabled,
        potentialMatches: cards,
        currentIndex: 0,
        matches: initialMatches,
        skippedCards: [],
        dashboardGridItems: initialGridItems,
        createdAt: now,
        updatedAt: now,
      }

      hydratedConnectionIdRef.current = connectionId
      setCurrentIndex(0)
      setMatches(initialMatches)
      setSkippedCards([])
      setDashboardGridItems(initialGridItems)
      setPotentialMatches(cards)
      setChartSummaries(createIdleChartSummaries(cards))
      setSavedConnections((previous) => [initialConnection, ...previous])
      setActiveConnectionId(connectionId)
      if (shouldOpenDashboardDirectly) {
        setScreen('dashboard')
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load chart cards from the selected dashboard.'
      setPotentialMatchesError(message)
    } finally {
      setPotentialMatchesLoading(false)
      scheduleAutosaveResume()
    }
  }

  const handleOpenDashboardStep = () => {
    if (!canOpenDashboardTab) {
      return
    }

    setIsDashboardLayoutEditing(false)
    setOpenBucket(null)
    setEditingConnectionId(null)
    setEditingConnectionName('')
    setShowConnectionsModal(true)
  }

  const handleGoToActiveDashboard = () => {
    if (!canOpenDashboardTab) {
      return
    }

    setShowConnectionsModal(false)
    if (!activeConnectionId && savedConnections[0]) {
      setActiveConnectionId(savedConnections[0].id)
    }
    setScreen('dashboard')
  }

  const handleSelectConnection = (connectionId: string) => {
    setEditingConnectionId(null)
    setEditingConnectionName('')

    if (connectionId === activeConnectionId) {
      setScreen('dashboard')
      setShowConnectionsModal(false)
      return
    }

    setActiveConnectionId(connectionId)
    setScreen('dashboard')
    setShowConnectionsModal(false)
  }

  const handleStartNewConnection = () => {
    setEditingConnectionId(null)
    setEditingConnectionName('')
    setShowConnectionsModal(false)
    setScreen('profile')
    setIsDashboardLayoutEditing(false)
    setOpenBucket(null)
  }

  const handleReopenSkippedCards = () => {
    const skippedIds = new Set(skippedCards.map((card) => card.id))
    const basePotentialMatches = potentialMatches.filter(
      (card) => !skippedIds.has(card.id),
    )
    const existingIds = new Set(basePotentialMatches.map((card) => card.id))
    const reopenedCards = skippedCards.filter((card) => !existingIds.has(card.id))
    const nextPotentialMatches = [...basePotentialMatches, ...reopenedCards]
    const reviewStartIndex = Math.max(
      nextPotentialMatches.length - reopenedCards.length,
      0,
    )

    setShowAiModal(false)
    setPotentialMatchesError('')
    setIsDashboardLayoutEditing(false)
    setOpenBucket(null)
    setPotentialMatches(nextPotentialMatches)
    setCurrentIndex(reviewStartIndex)
    setSkippedCards([])
    setScreen('discover')
  }

  const handleEnterCreateMatchMode = () => {
    setAiModalStage('create')
    setIqError('')
    setIqSaveMessage('')
  }

  const buildPotentialMatchFromIqConfig = useCallback(
    (payload: unknown): PotentialMatch | null => {
      const parsedConfig = parseIqGeneratedChartConfig(payload)
      if (!parsedConfig) {
        return null
      }

      const normalizedSlots = normalizeSlots(parsedConfig.rawSlots)
      const datasetIdFromSlots = inferDatasetId(normalizedSlots)
      const fallbackDatasetId =
        builderSelectedDatasetId ||
        builderDatasetIds[0] ||
        potentialMatches.find((card) => card.datasetId !== 'unknown-dataset')?.datasetId ||
        matches.find((card) => card.datasetId !== 'unknown-dataset')?.datasetId ||
        'unknown-dataset'
      const datasetId =
        datasetIdFromSlots && datasetIdFromSlots !== 'unknown-dataset'
          ? datasetIdFromSlots
          : fallbackDatasetId

      const datasetName =
        datasetNameById[datasetId] ||
        potentialMatches.find((card) => card.datasetId === datasetId)?.datasetName ||
        matches.find((card) => card.datasetId === datasetId)?.datasetName ||
        selectedDashboard?.name ||
        activeDashboardName ||
        'Selected Dataset'

      const generatedId = `ai-chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const sourceDashboardName =
        selectedDashboard?.name || activeDashboardName || 'Selected Dashboard'
      const generatedTitle = parsedConfig.title.trim() || `IQ ${humanizeVizType(parsedConfig.vizType)}`
      const optionsWithTitle = {
        ...parsedConfig.options,
        title:
          (isRecord(parsedConfig.options.title) || typeof parsedConfig.options.title === 'string'
            ? parsedConfig.options.title
            : { en: generatedTitle }),
      }

      return {
        id: generatedId,
        renderMode: 'flex-config',
        useItemReference: false,
        sourceDashboardId: selectedDashboardId,
        sourceItemId: generatedId,
        title: generatedTitle,
        chartType: humanizeVizType(parsedConfig.vizType),
        vizType: parsedConfig.vizType,
        datasetId,
        datasetName,
        sourceDashboardName,
        rawSlots: normalizedSlots,
        slots: normalizedSlots,
        aiSummary:
          'Generated by Luzmo AI Chart. Save it to your dashboard if this match looks right.',
        options: optionsWithTitle,
      }
    },
    [
      activeDashboardName,
      builderDatasetIds,
      builderSelectedDatasetId,
      datasetNameById,
      matches,
      potentialMatches,
      selectedDashboard,
      selectedDashboardId,
    ],
  )

  const handleAppendAiColumnToPrompt = useCallback((column: VizSlotContent) => {
    const columnLabel = slotValueLabel(column).trim()
    if (!columnLabel) {
      return
    }

    setIqPrompt((previous) => {
      const trimmed = previous.trim()
      if (!trimmed) {
        return columnLabel
      }
      return `${trimmed}, ${columnLabel}`
    })

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const textarea = iqPromptTextareaRef.current
        if (!textarea) {
          return
        }
        textarea.focus()
        const cursorPosition = textarea.value.length
        textarea.setSelectionRange(cursorPosition, cursorPosition)
      })
    }
  }, [])

  useEffect(() => {
    if (!showAiModal || aiModalStage !== 'create' || createMatchMode !== 'ai') {
      return
    }

    const datasetId = aiPromptDatasetId.trim()
    if (!datasetId || datasetId === 'unknown-dataset') {
      setAiColumnsLoading(false)
      setAiColumnsError('No dataset selected for column suggestions.')
      return
    }

    const cachedColumns = aiColumnsByDatasetId[datasetId]
    if (Array.isArray(cachedColumns)) {
      setAiColumnsLoading(false)
      setAiColumnsError(
        cachedColumns.length === 0
          ? 'No dataset columns are available for quick prompt insertion.'
          : '',
      )
      return
    }

    let cancelled = false
    setAiColumnsLoading(true)
    setAiColumnsError('')

    const loadColumns = async () => {
      let columns = await fetchDatasetColumnContents(datasetId)
      if (columns.length === 0) {
        columns = extractDatasetColumnContentsFromCards(
          [...potentialMatches, ...matches],
          datasetId,
        )
      }

      const dedupedColumns = dedupeSlotContentsByColumn(columns)
      if (cancelled) {
        return
      }

      setAiColumnsByDatasetId((previous) => ({
        ...previous,
        [datasetId]: dedupedColumns,
      }))
      if (dedupedColumns.length === 0) {
        setAiColumnsError('No dataset columns are available for quick prompt insertion.')
      }
    }

    void loadColumns()
      .catch(() => {
        if (!cancelled) {
          setAiColumnsError('Could not load dataset columns for AI prompt hints.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAiColumnsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    aiColumnsByDatasetId,
    aiModalStage,
    aiPromptDatasetId,
    createMatchMode,
    matches,
    potentialMatches,
    showAiModal,
  ])

  const handleGenerateIqChart = useCallback(async () => {
    const prompt = iqPrompt.trim()
    if (!prompt) {
      setIqError('Describe the chart you want to generate first.')
      return
    }

    const datasetId = aiPromptDatasetId
    if (!datasetId || datasetId === 'unknown-dataset') {
      setIqError('No dataset is selected for AI chart generation.')
      return
    }

    iqRequestAbortRef.current?.abort()
    const controller = new AbortController()
    iqRequestAbortRef.current = controller

    setIqLoading(true)
    setIqError('')
    setIqSaveMessage('')
    setIqGeneratedCard(null)
    setIqChatMessages((previous) => [...previous, { role: 'user', text: prompt }])
    setIqPrompt('')

    let lastError = 'Could not generate a chart with AI Chart.'

    try {
      const payload = {
        version: '0.1.0',
        action: 'create',
        key: LUZMO_AUTH_KEY,
        token: LUZMO_AUTH_TOKEN,
        properties: {
          type: 'generate-chart',
          dataset_id: datasetId,
          question: prompt,
        },
      }

      const requestOnce = async (): Promise<unknown> => {
        const response = await fetch(`${LUZMO_API_HOST.replace(/\/$/, '')}/0.1.0/aichart`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })

        const contentType = response.headers.get('content-type') ?? ''
        const isJsonResponse = contentType.includes('application/json')
        if (!response.ok) {
          let errorPayload: unknown = null
          let errorText = ''
          if (isJsonResponse) {
            errorPayload = await response.json().catch(() => null)
          } else {
            errorText = await response.text().catch(() => '')
          }
          const requestError =
            parseIqMessageErrorText(errorPayload) ??
            (errorPayload ? JSON.stringify(errorPayload).slice(0, 320) : null) ??
            (errorText.trim() || null) ??
            `createAI-Chart request failed (${response.status}).`
          throw new Error(requestError)
        }

        return (await response.json().catch(() => null)) as unknown
      }

      let payloadJson: unknown = null
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          payloadJson = await requestOnce()
          break
        } catch (requestError) {
          const requestMessage =
            requestError instanceof Error && requestError.message.trim()
              ? requestError.message
              : lastError
          lastError = requestMessage

          if (attempt === 2) {
            setIqError(requestMessage)
            return
          }
        }
      }

      const generatedCard = buildPotentialMatchFromIqConfig(payloadJson)
      if (!generatedCard) {
        const errorText = parseIqMessageErrorText(payloadJson)
        setIqError(
          errorText ||
            'AI Chart returned no usable chart object. Try a more specific chart request.',
        )
        return
      }

      setIqGeneratedCard(generatedCard)
      setIqChatMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          text: 'Chart generated. Added to swipe stack.',
        },
      ])
      setPotentialMatches((previous) => {
        if (previous.some((card) => card.id === generatedCard.id)) {
          return previous
        }
        const next = [...previous, generatedCard]
        setCurrentIndex(next.length - 1)
        return next
      })
      setShowAiModal(false)
      setAiModalStage('entry')
      setScreen('discover')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Could not generate a chart with AI Chart.'
      setIqError(message)
    } finally {
      if (iqRequestAbortRef.current === controller) {
        iqRequestAbortRef.current = null
      }
      setIqLoading(false)
    }
  }, [
    aiPromptDatasetId,
    buildPotentialMatchFromIqConfig,
    iqPrompt,
    matches,
    potentialMatches,
  ])

  const handleStartConnectionRename = (connection: SavedConnection) => {
    setEditingConnectionId(connection.id)
    setEditingConnectionName(getConnectionDisplayName(connection))
  }

  const handleCancelConnectionRename = () => {
    setEditingConnectionId(null)
    setEditingConnectionName('')
  }

  const handleSaveConnectionRename = (connectionId: string) => {
    const nextName = editingConnectionName.trim()
    if (!nextName) {
      return
    }

    setSavedConnections((previous) =>
      previous.map((connection) =>
        connection.id === connectionId
          ? {
              ...connection,
              name: nextName,
              updatedAt: new Date().toISOString(),
            }
          : connection,
      ),
    )
    setEditingConnectionId(null)
    setEditingConnectionName('')
  }

  const handleDeleteConnection = (connectionId: string) => {
    const connection = savedConnections.find((entry) => entry.id === connectionId)
    if (!connection) {
      return
    }

    let confirmed = true
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        confirmed = window.confirm(
          `Delete "${getConnectionDisplayName(connection)}"? This removes only this saved connection.`,
        )
      }
    } catch {
      confirmed = true
    }

    if (!confirmed) {
      return
    }

    const nextConnections = savedConnections.filter(
      (entry) => entry.id !== connectionId,
    )

    setSavedConnections(nextConnections)

    if (editingConnectionId === connectionId) {
      setEditingConnectionId(null)
      setEditingConnectionName('')
    }

    if (activeConnectionId === connectionId) {
      if (nextConnections.length > 0) {
        setActiveConnectionId(nextConnections[0].id)
      } else {
        setActiveConnectionId(null)
        setScreen('profile')
        setShowConnectionsModal(false)
      }
    }
  }

  const handleSwipe = (direction: SwipeDirection) => {
    if (!topCard || swipeResolutionLockRef.current) {
      return
    }

    swipeResolutionLockRef.current = true
    if (swipeLockFailSafeTimerRef.current !== null) {
      window.clearTimeout(swipeLockFailSafeTimerRef.current)
    }
    swipeLockFailSafeTimerRef.current = window.setTimeout(() => {
      swipeResolutionLockRef.current = false
      swipeLockFailSafeTimerRef.current = null
    }, 2000)
    setOpenBucket(null)
    const isFinalCard = currentIndex >= potentialMatches.length - 1
    const isFinalRightSwipe = direction === 'right' && isFinalCard

    if (direction === 'right') {
      const shouldAutoMatch =
        !isRealismActive ||
        Math.random() < calculateRealismMatchChance(selectedPersona, topCard)
      if (shouldAutoMatch) {
        triggerSwipeFeedback('match')
        setMatches((previous) => [...previous, topCard])
      } else {
        triggerSwipeFeedback('no-match')
        setSkippedCards((previous) => [...previous, topCard])
      }
    } else {
      setSkippedCards((previous) => [...previous, topCard])
    }

    const advanceToNextCard = () => {
      setCurrentIndex((previous) => previous + 1)
      setSwipeInProgress(null)
      swipeResolutionLockRef.current = false
      if (swipeLockFailSafeTimerRef.current !== null) {
        window.clearTimeout(swipeLockFailSafeTimerRef.current)
        swipeLockFailSafeTimerRef.current = null
      }
    }

    if (swipeAdvanceTimerRef.current !== null) {
      window.clearTimeout(swipeAdvanceTimerRef.current)
    }
    if (swipeExitTimerRef.current !== null) {
      window.clearTimeout(swipeExitTimerRef.current)
    }

    if (isFinalRightSwipe) {
      const exitDelay = Math.max(0, SWIPE_FEEDBACK_VISIBLE_MS - SWIPE_CARD_EXIT_MS)
      swipeExitTimerRef.current = window.setTimeout(() => {
        swipeExitTimerRef.current = null
        setSwipeInProgress({
          cardId: topCard.id,
          direction,
        })
      }, exitDelay)

      swipeAdvanceTimerRef.current = window.setTimeout(() => {
        swipeAdvanceTimerRef.current = null
        advanceToNextCard()
      }, SWIPE_FEEDBACK_VISIBLE_MS)
      return
    }

    setSwipeInProgress({
      cardId: topCard.id,
      direction,
    })
    swipeAdvanceTimerRef.current = window.setTimeout(() => {
      swipeAdvanceTimerRef.current = null
      advanceToNextCard()
    }, SWIPE_CARD_EXIT_MS)
  }

  const handleMoveSkippedItemBackToStack = (cardId: string) => {
    const card = skippedCards.find((entry) => entry.id === cardId)
    if (!card) {
      return
    }

    const nextPotentialMatches = [...potentialMatches]
    let insertionIndex = Math.min(
      Math.max(currentIndex, 0),
      nextPotentialMatches.length,
    )

    const existingIndex = nextPotentialMatches.findIndex(
      (entry) => entry.id === cardId,
    )
    if (existingIndex !== -1) {
      nextPotentialMatches.splice(existingIndex, 1)
      if (existingIndex < insertionIndex) {
        insertionIndex -= 1
      }
    }

    nextPotentialMatches.splice(insertionIndex, 0, card)

    setPotentialMatches(nextPotentialMatches)
    setCurrentIndex(insertionIndex)
    setSkippedCards((previous) =>
      previous.filter((entry) => entry.id !== cardId),
    )
    setShowAiModal(false)
    setOpenBucket(null)
    setIsDashboardLayoutEditing(false)
    setScreen('discover')
  }

  const handleCreateAiCard = () => {
    const stateRawSlots = preserveRawSlots(builderSlotsContents)
    const panelRawSlots = preserveRawSlots(
      Array.isArray(slotPickerPanelRef.current?.slotsContents)
        ? slotPickerPanelRef.current?.slotsContents
        : [],
    )
    const countSlotEntries = (slots: VizSlot[]) =>
      slots.reduce(
        (total, slot) =>
          total + (Array.isArray(slot.content) ? slot.content.length : 0),
        0,
      )
    const normalizedRawSlots =
      countSlotEntries(panelRawSlots) > countSlotEntries(stateRawSlots)
        ? panelRawSlots
        : stateRawSlots
    if (countSlotEntries(normalizedRawSlots) !== countSlotEntries(stateRawSlots)) {
      setBuilderSlotsContents(normalizedRawSlots)
    }
    const {
      slots: hierarchyFilteredSlots,
      removedCount,
    } = enforceBuilderSlotRestrictions(normalizedRawSlots)
    const hasAtLeastOneSlot = hierarchyFilteredSlots.some(
      (slot) => Array.isArray(slot.content) && slot.content.length > 0,
    )

    if (!builderChartType) {
      setBuilderError('Pick a chart type first.')
      return
    }

    if (!hasAtLeastOneSlot) {
      setBuilderError('Select at least one slot value before adding this match.')
      return
    }

    if (removedCount > 0) {
      setBuilderSlotsContents(hierarchyFilteredSlots)
      setBuilderError(
        'Group-by accepts hierarchy only. Category, x-axis, and y-axis accept hierarchy or datetime only.',
      )
      return
    }

    const dashboardName = selectedDashboard?.name ?? activeDashboardName ?? 'Selected Dashboard'
    const generatedSlots = normalizeSlots(hierarchyFilteredSlots)
    const datasetId = inferDatasetId(generatedSlots)
    const datasetName =
      datasetNameById[datasetId] ??
      potentialMatches.find((card) => card.datasetId === datasetId)?.datasetName ??
      matches.find((card) => card.datasetId === datasetId)?.datasetName ??
      datasetId

    const generatedTitle = `Custom ${humanizeVizType(builderChartType)}`
    const generatedId = `ai-${Date.now()}`
    const generatedCard: PotentialMatch = {
      id: generatedId,
      renderMode: 'flex-config',
      useItemReference: false,
      sourceDashboardId: selectedDashboardId,
      sourceItemId: generatedId,
      title: generatedTitle,
      chartType: humanizeVizType(builderChartType),
      vizType: builderChartType,
      datasetId,
      datasetName,
      sourceDashboardName: dashboardName,
      rawSlots: hierarchyFilteredSlots,
      slots: generatedSlots,
      aiSummary:
        'Built with your selected chart type and slot mappings. Swipe right to match this card to your dashboard.',
      options: {
        title: {
          en: generatedTitle,
        },
        display: { title: true },
      },
    }

    setPotentialMatches((previous) => [...previous, generatedCard])
    setChartSummaries((previous) => ({
      ...previous,
      [generatedCard.id]: {
        status: 'idle',
        text: '',
      },
    }))
    setBuilderError('')
    setBuilderSlotsContents([])
    setShowAiModal(false)
    setAiModalStage('entry')
    setIsDashboardLayoutEditing(false)
    setScreen('discover')
  }

  return (
    <div className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      <luzmo-embed-dashboard ref={dashboardProbeRef} className="hidden" />
      <luzmo-embed-viz-item
        ref={csvExportVizRef}
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] top-0 block h-px w-px opacity-0"
      />

      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/70 bg-white/85 p-4 shadow-xl backdrop-blur md:p-8">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-teal-700 md:text-4xl">
              Pivot: The Dat<span className="inline-block align-[0.2em] text-[0.45em]">a</span>ing App
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            {(() => {
              const state = getStepState('profile')
              return (
                <button
                  className={`nav-pill ${getStepClassName(state, false)}`}
                  onClick={() => setScreen('profile')}
                  type="button"
                >
                  {state.isCompleted ? '\u2713 Profile Creation' : 'Profile Creation'}
                </button>
              )
            })()}

            {(() => {
              const state = getStepState('discover')
              return (
                <button
                  className={`nav-pill ${getStepClassName(
                    state,
                    !canOpenDiscoverTab,
                  )}`}
                  disabled={!canOpenDiscoverTab}
                  onClick={() => setScreen('discover')}
                  type="button"
                >
                  {state.isCompleted ? '\u2713 Potential Matches' : 'Potential Matches'}
                </button>
              )
            })()}

            {(() => {
              const state = getStepState('dashboard')
              return (
                <button
                  className={`nav-pill ${getStepClassName(
                    state,
                    !canOpenDashboardTab,
                  )}`}
                  disabled={!canOpenDashboardTab}
                  onClick={handleOpenDashboardStep}
                  type="button"
                >
                  {state.isCompleted
                    ? `\u2713 View Your Data Connections (${connectionsCount})`
                    : `View Your Data Connections (${connectionsCount})`}
                </button>
              )
            })()}
          </div>
        </header>

        {screen === 'profile' ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="panel-shell rounded-2xl p-5">
              <h2 className="text-xl font-semibold text-slate-900">
                What data persona are you?
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Select your data persona. Be warned, in Realism mode your data persona affects how likely it is the data will match with you!
              </p>
              <div className="mt-4 space-y-3">
                {PERSONAS.map((persona) => {
                  const checked = selectedPersona === persona
                  return (
                    <label
                      key={persona}
                      className={`choice-card ${checked ? 'choice-card-selected' : ''}`}
                    >
                      <input
                        checked={checked}
                        className="h-4 w-4 accent-teal-600"
                        name="persona"
                        onChange={() => setSelectedPersona(persona)}
                        type="radio"
                      />
                      <span>{persona}</span>
                    </label>
                  )
                })}
              </div>
            </article>

            <article className="panel-shell rounded-2xl p-5">
              <h2 className="text-xl font-semibold text-slate-900">
                What data gets you going?
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Choose the data you want to make a connection with
              </p>
              <div className="mt-4 space-y-3">
                {dashboardsLoading ? (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <luzmo-progress-circle indeterminate label="Loading dashboards" />
                    <span className="text-sm text-slate-600">
                      Fetching dashboard titles via your embed token...
                    </span>
                  </div>
                ) : null}

                {!dashboardsLoading && dashboardsError ? (
                  <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    {dashboardsError}
                  </p>
                ) : null}

                {dashboardOptions.map((dashboard) => {
                  const checked = selectedDashboardId === dashboard.id
                  const existingConnectionsCount =
                    savedConnectionsByDashboardId[dashboard.id] ?? 0
                  return (
                    <label
                      key={dashboard.id}
                      className={`choice-card ${checked ? 'choice-card-selected' : ''}`}
                    >
                      <input
                        checked={checked}
                        className="h-4 w-4 accent-teal-600"
                        name="dashboard"
                        onChange={() => setSelectedDashboardId(dashboard.id)}
                        type="radio"
                      />
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">{dashboard.name}</span>
                        {existingConnectionsCount > 0 ? (
                          <span className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                            {existingConnectionsCount === 1
                              ? '1 saved connection'
                              : `${existingConnectionsCount} saved connections`}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </div>
            </article>

            <div className="lg:col-span-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-stretch justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Realism mode</p>
                    <p className="text-xs text-slate-600">
                      Because some data has higher standards than your ex. Expect rejection
                    </p>
                    {isBoomerSelected ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Boomer flow skips swiping and opens your CSV/table dashboard directly.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        isRealismActive
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isRealismActive ? 'On' : 'Off'}
                    </span>
                    <button
                      aria-checked={isRealismActive}
                      aria-label="Toggle realism mode"
                      className={`relative inline-flex h-10 w-20 items-center rounded-full border-2 transition-all duration-200 ${
                        isRealismActive
                          ? 'border-teal-700 bg-gradient-to-r from-teal-600 to-emerald-500 shadow-[0_0_0_3px_rgba(20,184,166,0.22)]'
                          : 'border-slate-300 bg-white'
                      } ${
                        !selectedPersona || isBoomerSelected
                          ? 'cursor-not-allowed opacity-50'
                          : ''
                      }`}
                      disabled={!selectedPersona || isBoomerSelected}
                      onClick={() =>
                        setRealismModeEnabled((previous) => !previous)
                      }
                      role="switch"
                      type="button"
                    >
                      <span
                        className={`inline-block h-8 w-8 rounded-full bg-white shadow transition-transform duration-200 ${
                          isRealismActive ? 'translate-x-10' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              {canStart ? (
                <button
                  className="cta-button"
                  onClick={handleStartDashboardFlow}
                  type="button"
                >
                  Start making your dashboard
                </button>
              ) : (
                <p className="text-sm text-slate-500">
                  Select one persona and one dashboard to continue.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {screen === 'discover' ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100/80 px-4 py-3">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Data:</span>{' '}
                {activeDashboardName || selectedDashboard?.name || 'Not selected'}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Persona:</span>{' '}
                {selectedPersona || 'Not selected'}
              </p>
              {isRealismActive ? (
                <p className="text-sm font-semibold text-teal-700">Realism mode: ON</p>
              ) : null}
            </div>

            {potentialMatchesLoading ? (
              <div className="panel-shell rounded-2xl p-6 text-center">
                <div className="mx-auto flex max-w-md items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <luzmo-progress-circle indeterminate label="Loading charts" />
                  <span className="text-sm text-slate-600">
                    Building chart cards from your selected dashboard...
                  </span>
                </div>
              </div>
            ) : null}

            {!potentialMatchesLoading && potentialMatchesError ? (
              <div className="panel-shell rounded-2xl p-6 text-center">
                <h2 className="text-xl font-semibold text-slate-900">
                  Unable to build chart cards
                </h2>
                <p className="mt-2 text-sm text-slate-600">{potentialMatchesError}</p>
                <div className="mt-4">
                  <button
                    className="swipe-button swipe-button-match"
                    onClick={() => void handleStartDashboardFlow()}
                    type="button"
                  >
                    Retry with selected dashboard
                  </button>
                </div>
              </div>
            ) : null}

            {!potentialMatchesLoading && !potentialMatchesError && topCard ? (
              <div className="mx-auto w-full max-w-2xl">
                <div
                  className="relative overflow-visible"
                  style={{ height: `${discoverStackHeight}px` }}
                >
                  {remainingCards.map((card, index) => {
                    const isTop = index === 0
                    const isSwipingOut = swipeInProgress?.cardId === card.id
                    const swipeDirection = swipeInProgress?.direction
                    return (
                      <motion.article
                        key={card.id}
                        animate={{
                          x: isSwipingOut
                            ? swipeDirection === 'right'
                              ? 900
                              : -900
                            : 0,
                          rotate: isSwipingOut
                            ? swipeDirection === 'right'
                              ? 10
                              : -10
                            : 0,
                          scale: 1 - index * 0.03,
                          y: index * 12,
                          opacity: isSwipingOut ? 0 : 1,
                        }}
                        className={`absolute inset-0 ${
                          isTop ? 'pointer-events-auto' : 'pointer-events-none'
                        }`}
                        drag={isTop && !isSwipingOut ? 'x' : false}
                        dragControls={discoverDragControls}
                        dragListener={false}
                        dragElastic={0.8}
                        dragSnapToOrigin={!isSwipingOut}
                        onPointerDownCapture={(event) => {
                          if (!isTop || isSwipingOut) {
                            return
                          }
                          discoverDragControls.start(event)
                        }}
                        onDragEnd={(_, info) => {
                          if (!isTop) {
                            return
                          }

                          if (info.offset.x > 120) {
                            handleSwipe('right')
                          } else if (info.offset.x < -120) {
                            handleSwipe('left')
                          }
                        }}
                        style={{ zIndex: 50 - index, touchAction: 'pan-y' }}
                        transition={
                          isSwipingOut
                            ? { duration: 0.22, ease: 'easeOut' }
                            : { type: 'spring', stiffness: 260, damping: 24 }
                        }
                      >
                        <div ref={isTop ? handleTopCardMount : undefined}>
                          <FlexChartCard
                            card={card}
                            onChartDataReady={handleCardDataReady}
                            swipeFeedback={isTop ? swipeFeedback : null}
                            showSwipeFeedback={isTop ? showSwipeFeedback : false}
                            theme={PIVOT_THEME}
                          />
                          <MatchProfile
                            card={card}
                            summaryState={chartSummaries[card.id]}
                          />
                        </div>
                      </motion.article>
                    )
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
                    <SwipeBucketButton
                      bucket="matches"
                      count={matches.length}
                      isOpen={openBucket === 'matches'}
                      items={matches}
                      onClose={() =>
                        setOpenBucket((current) =>
                          current === 'matches' ? null : current,
                        )
                      }
                      onOpen={() => setOpenBucket('matches')}
                    />
                    <SwipeBucketButton
                      bucket="skips"
                      count={skippedCards.length}
                      isOpen={openBucket === 'skips'}
                      items={skippedCards}
                      onClose={() =>
                        setOpenBucket((current) =>
                          current === 'skips' ? null : current,
                        )
                      }
                      onMoveBackItem={handleMoveSkippedItemBackToStack}
                      onOpen={() => setOpenBucket('skips')}
                    />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">
                    {isRealismActive
                      ? 'Swipe left to pass, right to attempt a match'
                      : 'Swipe left to pass, right to match'}
                  </p>
                </div>
              </div>
            ) : null}

          </section>
        ) : null}

        {screen === 'dashboard' ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100/80 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">
                {activeConnectionName || activeDashboardName
                  ? `Your ${activeConnectionName || activeDashboardName} Connections`
                  : 'Your Data Connections'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    isDashboardLayoutEditing
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                  onClick={() =>
                    setIsDashboardLayoutEditing((previous) => !previous)
                  }
                  type="button"
                >
                  {isDashboardLayoutEditing ? 'Done editing layout' : 'Edit Dashboard'}
                </button>
                <p className="text-sm text-slate-700">
                  {(activeConnection?.matches.length ?? matches.length)} matches
                </p>
                <button
                  className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleReopenSkippedCards}
                  type="button"
                >
                  Re-open skipped cards ({skippedCards.length})/create new data profiles
                </button>
              </div>
            </div>

            {shouldShowCsvExport ? (
              <>
                <div className="rounded-2xl border border-teal-300/70 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-500 p-2 shadow-[0_16px_28px_-18px_rgba(13,148,136,0.95)]">
                  <button
                    className="w-full rounded-xl bg-transparent px-6 py-4 text-center text-xl font-extrabold tracking-[0.01em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!canExportCsv || csvExportInProgress}
                    onClick={handleCsvExport}
                    type="button"
                  >
                    {csvExportInProgress
                      ? 'Preparing CSV export...'
                      : 'Here is your F@c$ing CSV export'}
                  </button>
                </div>

                {csvExportStatus.message ? (
                  <p
                    className={`rounded-xl px-3 py-2 text-sm font-medium ${
                      csvExportStatus.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-800'
                        : csvExportStatus.tone === 'error'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {csvExportStatus.message}
                  </p>
                ) : null}
              </>
            ) : null}

            {matches.length === 0 ? (
              <div className="panel-shell rounded-2xl p-6 text-sm text-slate-600">
                No matched charts yet. Head to Potential Matches and swipe right on
                charts you want in your dashboard.
              </div>
            ) : (
              <div className="relative grid-shell rounded-2xl p-3 md:p-4">
                <luzmo-item-grid
                  ref={gridRef}
                  className="block min-h-[560px] w-full rounded-xl"
                />
              </div>
            )}
          </section>
        ) : null}

        {connectionsCount > 0 ? (
          <div className="mt-8 flex justify-end gap-3 border-t border-slate-200/80 pt-4">
            {screen !== 'profile' ? (
              <button
                className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                onClick={handleStartNewConnection}
                type="button"
              >
                Start a new connection
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showConnectionsModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">
              Your saved data connections
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Select which saved connection you want to open.
            </p>

            {savedConnections.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                No saved connections yet. Start a new one from Profile Creation.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {savedConnections.map((connection) => {
                  const isActive = connection.id === activeConnectionId
                  const isEditing = connection.id === editingConnectionId
                  const connectionDisplayName = getConnectionDisplayName(connection)
                  return (
                    <div
                      key={connection.id}
                      className={`w-full rounded-xl border px-4 py-3 transition ${
                        isActive
                          ? 'border-teal-600 bg-teal-50'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                            maxLength={80}
                            onChange={(event) =>
                              setEditingConnectionName(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                handleSaveConnectionRename(connection.id)
                              }
                            }}
                            value={editingConnectionName}
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-600">
                              Persona: {connection.persona} • Data:{' '}
                              {connection.sourceDashboardName}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                onClick={handleCancelConnectionRename}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                className="rounded-full border border-teal-300 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={!editingConnectionName.trim()}
                                onClick={() =>
                                  handleSaveConnectionRename(connection.id)
                                }
                                type="button"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <button
                            className="min-w-0 flex-1 text-left"
                            onClick={() => handleSelectConnection(connection.id)}
                            type="button"
                          >
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {connectionDisplayName}
                            </span>
                            <span className="block text-xs text-slate-600">
                              Persona: {connection.persona} • Data:{' '}
                              {connection.sourceDashboardName}
                            </span>
                          </button>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">
                              {connection.matches.length} matches
                            </span>
                            <button
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              onClick={() => handleStartConnectionRename(connection)}
                              type="button"
                            >
                              Rename
                            </button>
                            <button
                              aria-label={`Delete ${connectionDisplayName}`}
                              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleDeleteConnection(connection.id)
                              }}
                              title="Delete connection"
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-between gap-3">
              {screen !== 'profile' ? (
                <button
                  className="rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-100"
                  onClick={handleStartNewConnection}
                  type="button"
                >
                  Start a new connection
                </button>
              ) : <span />}
              <button
                className="swipe-button swipe-button-pass"
                onClick={() => {
                  setEditingConnectionId(null)
                  setEditingConnectionName('')
                  setShowConnectionsModal(false)
                }}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAiModal ? (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/40 px-4 py-4 sm:py-6">
          <div className="mx-auto flex min-h-full w-full items-start justify-center pt-[10vh] sm:pt-[12vh]">
            <div className="flex w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-2xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]">
            <div className="overflow-y-auto pr-1">
              <h3 className="text-xl font-semibold text-slate-900">
                You are out of possible data connections. Want to try to create your perfect data match?
              </h3>
              {aiModalStage === 'entry' ? (
                <>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose how you want to continue.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      className="swipe-button swipe-button-match"
                      onClick={handleEnterCreateMatchMode}
                      type="button"
                    >
                      Create your own perfect data match
                    </button>
                    <button
                      className="swipe-button swipe-button-neutral"
                      onClick={() => {
                        setShowAiModal(false)
                        handleGoToActiveDashboard()
                      }}
                      type="button"
                    >
                      Go directly to dashboard
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-600">
                    {createMatchMode === 'builder'
                      ? 'Choose a chart type first, then fill the matching slots below. Or go directly to your dashboard'
                      : 'Describe the chart you want. We will generate it through Luzmo AI Chart. Or, go directly to your dashboard'}
                  </p>

                  <div className="mt-4 flex justify-center">
                    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                      <button
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                          createMatchMode === 'builder'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                        onClick={() => {
                          setCreateMatchMode('builder')
                          setIqError('')
                          setIqSaveMessage('')
                        }}
                        type="button"
                      >
                        Build it yourself
                      </button>
                      <button
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                          createMatchMode === 'ai'
                            ? 'bg-teal-600 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                        onClick={() => {
                          setCreateMatchMode('ai')
                          setBuilderError('')
                        }}
                        type="button"
                      >
                        Use AI
                      </button>
                    </div>
                  </div>

                  {createMatchMode === 'builder' ? (
                    <>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <label
                          htmlFor="builder-chart-type"
                          className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
                        >
                          Chart type
                        </label>
                        <select
                          id="builder-chart-type"
                          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                          onChange={(event) => {
                            setBuilderChartType(event.target.value)
                            setBuilderSlotsContents([])
                            if (builderError) {
                              setBuilderError('')
                            }
                          }}
                          value={builderChartType}
                        >
                          {builderChartTypeOptions.map((chartTypeOption) => (
                            <option key={chartTypeOption} value={chartTypeOption}>
                              {humanizeVizType(chartTypeOption)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Configure slots
                        </p>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                          <luzmo-item-slot-picker-panel
                            key={builderSlotPanelKey}
                            ref={slotPickerPanelRef}
                          />
                        </div>
                      </div>

                      {builderError ? (
                        <p className="mt-2 text-sm font-medium text-red-600">{builderError}</p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                          AI chart assistant
                        </p>
                        <div className="mt-3 max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                          {iqChatMessages.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              Ask for a chart using your selected data connection.
                            </p>
                          ) : null}
                          {iqChatMessages.map((message, index) => (
                            <div
                              key={`iq-msg-${message.role}-${index}`}
                              className={`rounded-lg px-3 py-2 text-sm ${
                                message.role === 'user'
                                  ? 'ml-6 bg-teal-50 text-teal-900'
                                  : 'mr-6 bg-slate-100 text-slate-700'
                              }`}
                            >
                              {message.text}
                            </div>
                          ))}
                        </div>
                        <form
                          className="mt-3"
                          onSubmit={(event) => {
                            event.preventDefault()
                            void handleGenerateIqChart()
                          }}
                        >
                          <textarea
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                            onChange={(event) => setIqPrompt(event.target.value)}
                            placeholder="Example: Build a bar chart of Scope 1 emissions by country, grouped by industry."
                            ref={iqPromptTextareaRef}
                            rows={3}
                            value={iqPrompt}
                          />
                        </form>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Available columns in {aiPromptDatasetName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Click a column to add it to your prompt.
                          </p>
                          {aiColumnsLoading ? (
                            <p className="mt-2 text-sm text-slate-500">Loading columns...</p>
                          ) : aiAvailableColumns.length > 0 ? (
                            <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                              {aiAvailableColumns.map((column) => {
                                const columnTypeKey = getColumnTypeKey(column)
                                const badge = COLUMN_TYPE_BADGES[columnTypeKey]
                                const columnLabel = slotValueLabel(column)
                                const columnId =
                                  typeof column.columnId === 'string'
                                    ? column.columnId
                                    : columnLabel
                                return (
                                  <button
                                    key={`${aiPromptDatasetId}-${columnId}`}
                                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-teal-200 bg-teal-50/60 px-2.5 py-1 text-sm text-teal-800 transition hover:border-teal-300 hover:bg-teal-100"
                                    onClick={() => handleAppendAiColumnToPrompt(column)}
                                    title={`${badge.label} column`}
                                    type="button"
                                  >
                                    <span
                                      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border px-1 text-[0.68rem] font-semibold leading-none ${badge.className}`}
                                    >
                                      {renderColumnTypeIcon(columnTypeKey)}
                                    </span>
                                    <span className="max-w-[12rem] truncate text-left">
                                      {columnLabel}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              {aiColumnsError ||
                                'No dataset columns are available for quick prompt insertion.'}
                            </p>
                          )}
                        </div>
                        {iqError ? (
                          <p className="mt-2 text-sm font-medium text-red-600">{iqError}</p>
                        ) : null}
                        {iqSaveMessage ? (
                          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                            {iqSaveMessage}
                          </p>
                        ) : null}
                      </div>

                      {iqGeneratedCard ? (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Generated chart preview
                          </p>
                          <div className="mt-3">
                            <FlexChartCard card={iqGeneratedCard} theme={PIVOT_THEME} />
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>

              {aiModalStage === 'create' ? (
                <div className="mt-4 flex shrink-0 justify-center gap-3 border-t border-slate-200 pt-3">
                  <button
                    className="swipe-button swipe-button-neutral"
                    onClick={() => {
                      setShowAiModal(false)
                      handleGoToActiveDashboard()
                    }}
                    type="button"
                  >
                    Go directly to dashboard
                  </button>
                  {createMatchMode === 'builder' ? (
                    <button
                      className="swipe-button swipe-button-match"
                      onClick={handleCreateAiCard}
                      type="button"
                    >
                      Create Data Profile
                    </button>
                  ) : (
                    <button
                      className="swipe-button swipe-button-match"
                      disabled={iqLoading}
                      onClick={() => {
                        void handleGenerateIqChart()
                      }}
                      type="button"
                    >
                      {iqLoading ? 'Generating chart...' : 'Create Data Profile'}
                    </button>
                  )}
                </div>
              ) : null}
            </div>
              </div>
        </div>
      ) : null}

      {editingDashboardItem ? (
        <div
          className="fixed inset-0 z-[10000] bg-slate-900/40"
          onClick={closeDashboardItemEditor}
        >
          <aside
            className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Edit data options
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {humanizeVizType(editingDashboardItem.type)}
                </p>
              </div>
              <button
                className="swipe-button swipe-button-pass"
                onClick={closeDashboardItemEditor}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                  htmlFor="dashboard-item-title"
                >
                  Chart title
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  id="dashboard-item-title"
                  onChange={(event) => handleDashboardTitleChange(event.target.value)}
                  placeholder="Add a chart title"
                  type="text"
                  value={editingDashboardTitle}
                />
                <p className="mt-2 text-xs text-slate-500">
                  You can still use the Title toggle below to show or hide it.
                </p>
              </div>
              <div className="h-full rounded-xl border border-slate-200 bg-slate-50 p-3">
                <luzmo-item-option-panel ref={itemOptionPanelRef} />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default App
