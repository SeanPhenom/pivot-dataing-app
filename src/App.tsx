import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AccessibleDashboard } from '@luzmo/embed'
import { loadDataFieldsForDatasets } from '@luzmo/analytics-components-kit/utils'
import { getOptionsConfigByItemType } from '@luzmo/dashboard-contents-types/src/lib/shared/utils/options-config'
import { getSlotsConfigByItemType } from '@luzmo/dashboard-contents-types/src/lib/shared/utils/slots-config'
import type { SlotConfig } from '@luzmo/dashboard-contents-types/src/lib/shared/types/slots'
import type {
  OptionConfig,
  OptionsConfig,
} from '@luzmo/dashboard-contents-types/src/lib/shared/utils/options-config.types'

const LUZMO_AUTH_KEY = import.meta.env.VITE_LUZMO_AUTH_KEY ?? ''
const LUZMO_AUTH_TOKEN = import.meta.env.VITE_LUZMO_AUTH_TOKEN ?? ''
const LUZMO_API_HOST =
  import.meta.env.VITE_LUZMO_API_HOST ?? 'https://api.luzmo.com'
const LUZMO_APP_SERVER =
  import.meta.env.VITE_LUZMO_APP_SERVER ?? 'https://app.luzmo.com'

type Screen = 'profile' | 'discover' | 'dashboard'
type SwipeDirection = 'left' | 'right'
type SwipeBucket = 'matches' | 'skips'
type SwipeFeedback = 'match' | 'no-match' | null

type DashboardChoice = {
  id: string
  name: string
}

type VizSlotContent = {
  datasetId?: string
  columnId?: string
  formulaId?: string
  level?: number
  [key: string]: unknown
}

type VizSlot = {
  name: string
  content: VizSlotContent[]
}

type PotentialMatch = {
  id: string
  renderMode: 'flex-config'
  useItemReference?: boolean
  sourceDashboardId?: string
  sourceItemId: string
  title: string
  chartType: string
  vizType: string
  datasetId: string
  datasetName: string
  sourceDashboardName: string
  rawSlots: VizSlot[]
  slots: VizSlot[]
  aiSummary: string
  options: Record<string, unknown>
}

type SavedConnection = {
  id: string
  name: string
  sourceDashboardId: string
  sourceDashboardName: string
  persona: string
  realismMode?: boolean
  potentialMatches: PotentialMatch[]
  currentIndex: number
  matches: PotentialMatch[]
  skippedCards: PotentialMatch[]
  dashboardGridItems: LuzmoGridItem[]
  createdAt: string
  updatedAt: string
}

type ChartSummaryStatus = 'idle' | 'loading' | 'ready' | 'error'

type ChartSummaryState = {
  status: ChartSummaryStatus
  text: string
}

type AiModalStage = 'entry' | 'create'
type CreateMatchMode = 'builder' | 'ai'

type IqChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

type DashboardProbeElement = HTMLElement & {
  authKey?: string
  authToken?: string
  getAccessibleDashboards?: () => Promise<AccessibleDashboard[]>
}

type VizItemElement = HTMLElement & {
  authKey?: string
  authToken?: string
  appServer?: string
  apiHost?: string
  dashboardId?: string
  itemId?: string
  type?: string
  options?: Record<string, unknown>
  slots?: VizSlot[]
  getData?: () => unknown
  export?: (
    type?: 'png' | 'base64' | 'xlsx' | 'csv' | 'xlsx-raw' | 'csv-raw',
  ) => Promise<string | void>
}

type SlotPickerPanelElement = HTMLElement & {
  itemType?: string
  slotsConfiguration?: SlotConfig[]
  slotsContents?: VizSlot[]
  datasetIds?: string[]
  selectedDatasetId?: string
  datasetPicker?: boolean
  apiUrl?: string
  authKey?: string
  authToken?: string
  contentLanguage?: string
  selects?: string
  grows?: boolean
}

type ItemOptionPanelElement = HTMLElement & {
  language?: string
  itemType?: string
  options?: Record<string, unknown>
  slots?: VizSlot[]
  customOptionsConfiguration?: OptionsConfig
  apiUrl?: string
  authKey?: string
  authToken?: string
  size?: string
}

type LuzmoGridItem = {
  id: string
  type: string
  options: Record<string, unknown>
  slots: VizSlot[]
  position: {
    col: number
    row: number
    sizeX: number
    sizeY: number
  }
}

type LuzmoGridElement = HTMLElement & {
  authKey?: string
  authToken?: string
  appServer?: string
  apiHost?: string
  theme?: Record<string, unknown>
  language?: string
  contentLanguage?: string
  columns?: number
  rowHeight?: number
  viewMode?: boolean
  defaultItemActionsMenu?: Array<{
    type: 'group'
    actions: string[]
  }>
  deactivateItems?: () => number
  triggerItemAction?: (
    itemId: string,
    action: string,
    options?: { active?: boolean },
  ) => Promise<boolean | undefined>
  items?: LuzmoGridItem[]
}

type DashboardItemRaw = {
  id?: string
  type?: string
  options?: Record<string, unknown>
  slots?: unknown
}

type DashboardViewRaw = {
  screenModus?: string
  items?: DashboardItemRaw[]
}

type DashboardRowRaw = {
  id?: string
  name?: unknown
  contents?: {
    views?: DashboardViewRaw[]
  }
}

type DashboardSecurableResponse = {
  rows?: DashboardRowRaw[]
  count?: number
  message?: string
}

const PERSONAS = [
  'Caveman: Big Number Big Happy',
  'Boomer: Where the F@c$ is my CSV Export?',
  'Business user: I need this chart for my Quarterly Business Review',
  'Data Engineer: SQL is my love language',
]
const BOOMER_PERSONA_PREFIX = 'boomer:'
const CAVEMAN_PERSONA_PREFIX = 'caveman:'
const BUSINESS_PERSONA_PREFIX = 'business user:'
const DATA_ENGINEER_PERSONA_PREFIX = 'data engineer:'

const EXCLUDED_ITEM_TYPES = new Set([
  'spacer',
  'text',
  'image',
  'video',
  'iframeobject',
  'dynamic-imageobject',
])
const CONTROL_WIDGET_TYPE_KEYWORDS = ['filter', 'control', 'selector']
const AI_SUMMARY_MAX_ROWS = 100
const AI_SUMMARY_UNSUPPORTED_TYPE_KEYWORDS = [
  'number',
  ...CONTROL_WIDGET_TYPE_KEYWORDS,
]
const DASHBOARD_EDIT_ITEM_ACTIONS_MENU = [
  { type: 'group' as const, actions: ['item-options', 'delete'] },
]
const SAVED_CONNECTIONS_STORAGE_KEY = 'pivot-copy.saved-connections.v1'
const ACTIVE_CONNECTION_STORAGE_KEY = 'pivot-copy.active-connection-id.v1'
const SWIPE_FEEDBACK_VISIBLE_MS = 1150
const SWIPE_FEEDBACK_CLEAR_DELAY_MS = 1450
const SWIPE_CARD_EXIT_MS = 220

type MatchPersonaKey = 'caveman' | 'business' | 'data-engineer' | 'other'
type ColumnTypeKey = 'hierarchy' | 'datetime' | 'currency' | 'numeric' | 'text'

const REALISM_PERSONA_BASE_CHANCE: Record<MatchPersonaKey, number> = {
  caveman: 0.4,
  business: 0.6,
  'data-engineer': 0.8,
  other: 0.55,
}
const REALISM_MATCH_STRICTNESS = 0.78
const REALISM_MAX_MATCH_CHANCE = 0.84
const COLUMN_TYPE_BADGES: Record<
  ColumnTypeKey,
  { label: string; className: string }
> = {
  hierarchy: {
    label: 'Hierarchy',
    className: 'border-teal-300 bg-teal-50 text-teal-700',
  },
  datetime: {
    label: 'Datetime',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  currency: {
    label: 'Currency',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  numeric: {
    label: 'Numeric',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  text: {
    label: 'Text',
    className: 'border-slate-300 bg-slate-50 text-slate-700',
  },
}

function renderColumnTypeIcon(type: ColumnTypeKey): ReactNode {
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

function clampChance(value: number): number {
  return Math.min(0.95, Math.max(0.1, value))
}

function isFilterOrControlVizType(vizType: string): boolean {
  const normalized = vizType.trim().toLowerCase()
  return CONTROL_WIDGET_TYPE_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

function getPersonaMatchKey(persona: string): MatchPersonaKey {
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

function getChartTypeModifier(vizType: string): number {
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
    return 0.1
  }
  if (normalized.includes('line-chart')) {
    return 0.08
  }
  if (normalized.includes('regular-table') || normalized.includes('pivot-table')) {
    return 0.12
  }
  if (normalized.includes('scatter-plot')) {
    return -0.02
  }
  if (normalized.includes('heatmap')) {
    return -0.15
  }
  if (normalized.includes('heat-table')) {
    return -0.12
  }
  if (normalized.includes('sankey')) {
    return -0.25
  }
  if (normalized.includes('funnel')) {
    return -0.1
  }
  if (normalized.includes('map')) {
    return -0.1
  }

  return 0
}

function getPersonaAffinityModifier(persona: string, vizType: string): number {
  const personaKey = getPersonaMatchKey(persona)
  const normalized = vizType.trim().toLowerCase()
  const isNumber = normalized.includes('number')
  const isEvolutionNumber = normalized.includes('evolution-number')
  const isBarOrColumn =
    normalized.includes('bar-chart') || normalized.includes('column-chart')
  const isLine = normalized.includes('line-chart')
  const isTable =
    normalized.includes('regular-table') || normalized.includes('pivot-table')
  const isScatter = normalized.includes('scatter-plot')
  const isHeat = normalized.includes('heatmap') || normalized.includes('heat-table')
  const isSankey = normalized.includes('sankey')

  if (personaKey === 'caveman') {
    if (isEvolutionNumber) return 0.1
    if (isNumber) return 0.15
    if (isBarOrColumn) return 0.05
    if (isScatter) return -0.05
    if (isHeat) return -0.1
    if (isSankey) return -0.15
    return 0
  }

  if (personaKey === 'business') {
    if (isBarOrColumn || isLine) return 0.1
    if (isTable) return 0.12
    if (isEvolutionNumber) return 0.05
    if (isNumber) return 0.05
    if (isHeat) return -0.08
    if (isSankey) return -0.12
    return 0
  }

  if (personaKey === 'data-engineer') {
    if (isScatter) return 0.1
    if (isHeat) return 0.12
    if (isSankey) return 0.1
    if (isLine) return 0.05
    if (isTable) return 0.03
    if (isEvolutionNumber) return -0.05
    if (isNumber) return -0.05
    return 0
  }

  return 0
}

function calculateRealismMatchChance(persona: string, card: PotentialMatch): number {
  if (isFilterOrControlVizType(card.vizType)) {
    return 1
  }

  const personaKey = getPersonaMatchKey(persona)
  const base = REALISM_PERSONA_BASE_CHANCE[personaKey]
  const chartTypeModifier = getChartTypeModifier(card.vizType)
  const personaAffinityModifier = getPersonaAffinityModifier(persona, card.vizType)
  const weightedChance =
    (base + chartTypeModifier + personaAffinityModifier) * REALISM_MATCH_STRICTNESS

  return Math.min(REALISM_MAX_MATCH_CHANCE, clampChance(weightedChance))
}
function buildPivotTheme(
  themeName: string,
  colors: string[],
  tooltipBackground: string,
): Record<string, unknown> {
  return {
    type: 'custom',
    name: themeName,
    mainColor: '#0f766e',
    itemsBackground: 'rgb(255, 255, 255)',
    font: {
      fontFamily:
        'Space Grotesk, Avenir Next, Segoe UI Variable, Segoe UI, sans-serif',
      fontSize: 14,
    },
    colors,
    title: {
      align: 'left',
      bold: true,
      fontSize: 18,
      lineHeight: 24,
    },
    legend: {
      type: 'normal',
      fontSize: 12,
      lineHeight: 18,
    },
    tooltip: {
      fontSize: 12,
      background: tooltipBackground,
      opacity: 0.92,
    },
    borders: {
      'border-style': 'solid',
      'border-color': 'rgba(148, 163, 184, 0.35)',
      'border-radius': '12px',
      'border-top-width': '1px',
      'border-right-width': '1px',
      'border-bottom-width': '1px',
      'border-left-width': '1px',
    },
    boxShadow: {
      size: 'S',
      color: 'rgba(15, 23, 42, 0.18)',
    },
  }
}

const PIVOT_THEME = buildPivotTheme(
  'pivot-signature',
  ['#0f766e', '#14b8a6', '#0d9488', '#10b981', '#22c55e', '#84cc16', '#64748b', '#0f172a'],
  'rgb(15, 23, 42)',
)

function loadSavedConnectionsFromStorage(): SavedConnection[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(SAVED_CONNECTIONS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((entry): entry is SavedConnection => isRecord(entry)) as SavedConnection[]
  } catch {
    return []
  }
}

function loadActiveConnectionIdFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY)
    if (!raw || !raw.trim()) {
      return null
    }
    return raw
  } catch {
    return null
  }
}

function getConnectionDisplayName(connection: SavedConnection): string {
  const preferredName = typeof connection.name === 'string' ? connection.name.trim() : ''
  if (preferredName) {
    return preferredName
  }

  const sourceName =
    typeof connection.sourceDashboardName === 'string'
      ? connection.sourceDashboardName.trim()
      : ''
  if (sourceName) {
    return sourceName
  }

  return 'Untitled connection'
}

function createUniqueConnectionName(
  baseName: string,
  existingConnections: SavedConnection[],
): string {
  const normalizedBase = baseName.trim() || 'Data Connection'
  const existingNames = new Set(
    existingConnections.map((connection) =>
      getConnectionDisplayName(connection).toLowerCase(),
    ),
  )

  if (!existingNames.has(normalizedBase.toLowerCase())) {
    return normalizedBase
  }

  let index = 2
  let candidate = `${normalizedBase} (${index})`
  while (existingNames.has(candidate.toLowerCase())) {
    index += 1
    candidate = `${normalizedBase} (${index})`
  }

  return candidate
}

function isBoomerPersona(persona: string): boolean {
  return persona.trim().toLowerCase().startsWith(BOOMER_PERSONA_PREFIX)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function localizeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value
  }

  if (isRecord(value)) {
    if (typeof value.en === 'string') {
      return value.en
    }

    const firstString = Object.values(value).find(
      (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
    )

    if (firstString) {
      return firstString
    }
  }

  return fallback
}

function humanizeVizType(vizType: string): string {
  return vizType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeSlots(rawSlots: unknown): VizSlot[] {
  if (!Array.isArray(rawSlots)) {
    return []
  }

  const normalizeSlotContentEntry = (entry: VizSlotContent): VizSlotContent => {
    const normalized = { ...entry }

    if (typeof normalized.datasetId !== 'string' && typeof normalized.set === 'string') {
      normalized.datasetId = normalized.set
    }

    if (typeof normalized.columnId !== 'string' && typeof normalized.column === 'string') {
      normalized.columnId = normalized.column
    }

    if (typeof normalized.formulaId !== 'string' && typeof normalized.formula === 'string') {
      normalized.formulaId = normalized.formula
    }

    return normalized
  }

  return rawSlots
    .filter((slot): slot is { name?: unknown; content?: unknown } => isRecord(slot))
    .filter((slot) => typeof slot.name === 'string')
    .map((slot) => ({
      name: slot.name as string,
      content: Array.isArray(slot.content)
        ? slot.content
            .filter((entry): entry is VizSlotContent => isRecord(entry))
            .map(normalizeSlotContentEntry)
        : [],
    }))
}

function preserveRawSlots(rawSlots: unknown): VizSlot[] {
  if (!Array.isArray(rawSlots)) {
    return []
  }

  return rawSlots
    .filter((slot): slot is { name?: unknown; content?: unknown } => isRecord(slot))
    .filter((slot) => typeof slot.name === 'string')
    .map((slot) => ({
      ...slot,
      name: slot.name as string,
      content: Array.isArray(slot.content)
        ? slot.content.filter((entry): entry is VizSlotContent => isRecord(entry))
        : [],
    }))
}

function isHierarchySlotContent(content: VizSlotContent): boolean {
  const type = typeof content.type === 'string' ? content.type.toLowerCase() : ''
  const subtype =
    typeof content.subtype === 'string' ? content.subtype.toLowerCase() : ''

  if (type.includes('hierarchy') || subtype.includes('hierarchy')) {
    return true
  }

  if (typeof content.level === 'number' || typeof content.lowestLevel === 'number') {
    return true
  }

  return false
}

function isHierarchyOrDatetimeSlotContent(content: VizSlotContent): boolean {
  const type = typeof content.type === 'string' ? content.type.toLowerCase() : ''
  const subtype =
    typeof content.subtype === 'string' ? content.subtype.toLowerCase() : ''

  if (
    type.includes('hierarchy') ||
    type.includes('datetime') ||
    subtype.includes('hierarchy') ||
    subtype.includes('datetime')
  ) {
    return true
  }

  return false
}

function getColumnTypeKey(content: VizSlotContent): ColumnTypeKey {
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

function isGroupBySlotName(slotName: string): boolean {
  const normalized = slotName.toLowerCase()
  const groupByIndicators = ['group', 'legend']

  return groupByIndicators.some((indicator) => normalized.includes(indicator))
}

function isCategoryAxisSlotName(slotName: string): boolean {
  const normalized = slotName.toLowerCase().replace(/[\s_-]/g, '')
  return normalized === 'xaxis' || normalized === 'yaxis' || normalized === 'category'
}

function applyBuilderSlotRestrictionsConfig(slotsConfig: SlotConfig[]): SlotConfig[] {
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

function enforceBuilderSlotRestrictions(rawSlots: VizSlot[]): {
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

function slotValueLabel(content: VizSlotContent): string {
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

function inferDatasetId(slots: VizSlot[]): string {
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

function buildAiSummary(vizType: string, slots: VizSlot[]): string {
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

function hasColumnsInSlots(slots: VizSlot[]): boolean {
  return slots.some((slot) => Array.isArray(slot.content) && slot.content.length > 0)
}

function extractColumnLabels(slots: VizSlot[]): string[] {
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

function extractDisplayValue(value: unknown): unknown {
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

function getItemDataRows(itemData: unknown): unknown[] {
  if (Array.isArray(itemData)) {
    return itemData
  }

  if (isRecord(itemData) && Array.isArray(itemData.data)) {
    return itemData.data
  }

  return []
}

function sanitizeFileName(value: string): string {
  const normalized = value
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()

  return normalized || 'pivot-data-export'
}

function triggerCsvDownloadFromExportResult(result: string, fileName: string): void {
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

function waitForVizItemRender(viz: VizItemElement, timeoutMs = 9000): Promise<void> {
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

function extractChartDataRows(
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

function parseAiSummaryText(payload: unknown): string | null {
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

function parseAiSummaryErrorText(payload: unknown): string | null {
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

function filterOutPaddingFromOptionsConfig(
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

function parseAiSummaryStreamText(payload: unknown): string | null {
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

function isAiSummaryStreamDone(payload: unknown): boolean {
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

function mergeStreamSummaryText(previous: string, next: string): string {
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

async function consumeAiSummaryStream(
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

async function waitWithAbort(signal: AbortSignal, delayMs: number): Promise<void> {
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

function parseIqMessageErrorText(payload: unknown): string | null {
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
      payload.data.description,
    )
  }

  const firstError = candidates.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  return firstError ?? null
}

function tryParseRecord(value: unknown): Record<string, unknown> | null {
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
    // IQ can occasionally return explanatory text plus embedded JSON.
    // Try to recover the first JSON object block and parse that.
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
                // Continue scanning in case a later object parses successfully.
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

function findIqChartPayloadCandidate(
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

function parseIqGeneratedChartConfig(payload: unknown): {
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

function isSummarizableItemType(itemType: string): boolean {
  const normalized = itemType.toLowerCase()
  if (EXCLUDED_ITEM_TYPES.has(normalized)) {
    return false
  }

  return true
}

function isAiSummaryUnsupportedType(itemType: string): boolean {
  const normalized = itemType.toLowerCase()
  return AI_SUMMARY_UNSUPPORTED_TYPE_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  )
}

function isSwipableChartItem(item: DashboardItemRaw): boolean {
  if (!item.type || typeof item.type !== 'string') {
    return false
  }

  if (!isSummarizableItemType(item.type)) {
    return false
  }

  return true
}

async function fetchDashboardPotentialMatches(
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
        useItemReference: true,
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

function dedupeSlotContentsByColumn(
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

function extractDatasetColumnContentsFromRow(
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

async function fetchDatasetColumnContents(datasetId: string): Promise<VizSlotContent[]> {
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

function extractDatasetColumnContentsFromCards(
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

async function buildBoomerCsvCard({
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

function toGridItems(cards: PotentialMatch[]): LuzmoGridItem[] {
  return cards.map((card, index) => {
    const row = Math.floor(index / 2) * 18
    const col = (index % 2) * 24

    return {
      id: card.id,
      type: card.vizType,
      options: card.options,
      slots: card.slots,
      position: {
        col,
        row,
        sizeX: 24,
        sizeY: 16,
      },
    }
  })
}

function createIdleChartSummaries(
  cards: PotentialMatch[],
): Record<string, ChartSummaryState> {
  return Object.fromEntries(
    cards.map((card) => [
      card.id,
      {
        status: 'idle',
        text: '',
      } satisfies ChartSummaryState,
    ]),
  )
}

function stripThemeFromOptions(options: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(options.theme)) {
    return options
  }

  const { theme: _theme, ...rest } = options
  return rest
}

function withPivotPreviewTheme(
  options: Record<string, unknown>,
  theme: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...stripThemeFromOptions(options),
    theme,
  }
}

function stripThemeFromCard(card: PotentialMatch): PotentialMatch {
  return {
    ...card,
    options: stripThemeFromOptions(card.options ?? {}),
  }
}

function sanitizeConnectionThemes(connection: SavedConnection): SavedConnection {
  return {
    ...connection,
    potentialMatches: connection.potentialMatches.map(stripThemeFromCard),
    matches: connection.matches.map(stripThemeFromCard),
    dashboardGridItems: connection.dashboardGridItems.map((item) => ({
      ...item,
      options: stripThemeFromOptions(item.options ?? {}),
    })),
  }
}

function mergeGridItemsWithMatches(
  existingItems: LuzmoGridItem[],
  cards: PotentialMatch[],
): LuzmoGridItem[] {
  const defaults = toGridItems(cards)
  const byId = new Map(existingItems.map((item) => [item.id, item]))

  return defaults.map((item) => {
    const existing = byId.get(item.id)
    if (!existing) {
      return item
    }

    return {
      ...item,
      position: existing.position ?? item.position,
      options: existing.options ?? item.options,
      slots: existing.slots ?? item.slots,
      type: existing.type ?? item.type,
    }
  })
}

function areGridItemsEqual(a: LuzmoGridItem[], b: LuzmoGridItem[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return JSON.stringify(a) === JSON.stringify(b)
}

function FlexChartCard({
  card,
  onChartDataReady,
  swipeFeedback,
  showSwipeFeedback,
  theme,
}: {
  card: PotentialMatch
  onChartDataReady?: (cardId: string, itemData: unknown) => void
  swipeFeedback?: SwipeFeedback
  showSwipeFeedback?: boolean
  theme: Record<string, unknown>
}) {
  const vizMountRef = useRef<HTMLDivElement | null>(null)
  const onChartDataReadyRef = useRef(onChartDataReady)
  const [isVizReady, setIsVizReady] = useState(false)

  useEffect(() => {
    onChartDataReadyRef.current = onChartDataReady
  }, [onChartDataReady])

  useEffect(() => {
    const mount = vizMountRef.current
    if (!mount) {
      return
    }
    setIsVizReady(false)
    let isUnmounted = false

    const viz = document.createElement('luzmo-embed-viz-item') as VizItemElement
    const vizOptions = withPivotPreviewTheme(card.options ?? {}, theme)
    viz.style.width = '100%'
    viz.style.height = '100%'
    viz.style.display = 'block'
    // Swipe is the primary interaction in discover mode, so prevent the embedded
    // chart from capturing pointer/touch gestures and blocking card dragging.
    viz.style.pointerEvents = 'none'

    viz.authKey = LUZMO_AUTH_KEY
    viz.authToken = LUZMO_AUTH_TOKEN
    viz.appServer = LUZMO_APP_SERVER
    viz.apiHost = LUZMO_API_HOST
    viz.type = card.vizType
    viz.options = vizOptions
    viz.slots = card.rawSlots ?? []
    const useItemReference =
      card.useItemReference ??
      !card.sourceItemId.toLowerCase().startsWith('ai-')
    if (useItemReference && card.sourceDashboardId) {
      viz.dashboardId = card.sourceDashboardId
      viz.itemId = card.sourceItemId
    }

    viz.setAttribute('authKey', LUZMO_AUTH_KEY)
    viz.setAttribute('authToken', LUZMO_AUTH_TOKEN)
    viz.setAttribute('appServer', LUZMO_APP_SERVER)
    viz.setAttribute('apiHost', LUZMO_API_HOST)
    viz.setAttribute('type', card.vizType)
    viz.setAttribute('options', JSON.stringify(vizOptions))
    viz.setAttribute('slots', JSON.stringify(card.rawSlots ?? []))
    if (useItemReference && card.sourceDashboardId) {
      viz.setAttribute('dashboardId', card.sourceDashboardId)
      viz.setAttribute('itemId', card.sourceItemId)
    }

    mount.replaceChildren(viz)

    let retryTimer: ReturnType<typeof window.setInterval> | null = null
    let retryAttempts = 0
    const maxRetryAttempts = 8
    const retryIntervalMs = 700

    const emitDataReady = () => {
      try {
        const itemData = viz.getData ? viz.getData() : null
        onChartDataReadyRef.current?.(card.id, itemData)

        if (getItemDataRows(itemData).length > 0) {
          if (retryTimer !== null) {
            window.clearInterval(retryTimer)
            retryTimer = null
          }
        }
      } catch {
        onChartDataReadyRef.current?.(card.id, null)
      }
    }

    const onRendered = () => {
      if (!isUnmounted) {
        setIsVizReady(true)
      }
      emitDataReady()

      if (retryTimer !== null) {
        window.clearInterval(retryTimer)
      }

      retryAttempts = 0
      retryTimer = window.setInterval(() => {
        retryAttempts += 1
        emitDataReady()

        if (retryAttempts >= maxRetryAttempts && retryTimer !== null) {
          window.clearInterval(retryTimer)
          retryTimer = null
        }
      }, retryIntervalMs)
    }

    const onVizError = () => {
      if (!isUnmounted) {
        setIsVizReady(true)
      }
    }

    const readyTimeout = window.setTimeout(() => {
      if (!isUnmounted) {
        setIsVizReady(true)
      }
    }, 12000)

    viz.addEventListener('rendered', onRendered as EventListener)
    viz.addEventListener('error', onVizError as EventListener)

    return () => {
      isUnmounted = true
      window.clearTimeout(readyTimeout)
      viz.removeEventListener('rendered', onRendered as EventListener)
      viz.removeEventListener('error', onVizError as EventListener)
      if (retryTimer !== null) {
        window.clearInterval(retryTimer)
      }
      if (mount.firstChild === viz) {
        mount.replaceChildren()
      }
    }
  }, [card, theme])

  return (
    <div className="card-shell rounded-2xl p-4">
      <div className="relative h-[270px] w-full overflow-hidden rounded-xl">
        <div
          className={`h-full w-full transition-opacity duration-300 ${
            isVizReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div ref={vizMountRef} className="h-full w-full" />
        </div>
        {!isVizReady ? (
          <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-white/45">
            <div className="pivot-heart-loader-wrap" role="status" aria-label="Loading chart">
              <svg
                aria-hidden="true"
                className="pivot-heart-loader-svg"
                viewBox="0 0 120 110"
              >
                <path
                  d="M60 102C57 98 50 91 41 83C24 68 10 54 10 37C10 22 21 12 35 12C44 12 53 16 60 24C67 16 76 12 85 12C99 12 110 22 110 37C110 54 96 68 79 83C70 91 63 98 60 102Z"
                  fill="currentColor"
                />
              </svg>
            </div>
          </div>
        ) : null}
        <div
          className={`pointer-events-none absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
            showSwipeFeedback ? 'opacity-100' : '-translate-y-[56%] opacity-0'
          }`}
        >
          {swipeFeedback === 'no-match' ? (
            <div className="rounded-full border border-rose-200 bg-rose-50 px-6 py-2.5 text-center text-sm font-semibold text-rose-800 shadow-md">
              No Match: It&apos;s not you, it&apos;s the metadata
            </div>
          ) : (
            <div className="relative h-[170px] w-[204px]">
              <svg
                viewBox="0 0 120 110"
                className="h-full w-full drop-shadow-md"
                aria-hidden="true"
              >
                <path
                  d="M60 102C57 98 50 91 41 83C24 68 10 54 10 37C10 22 21 12 35 12C44 12 53 16 60 24C67 16 76 12 85 12C99 12 110 22 110 37C110 54 96 68 79 83C70 91 63 98 60 102Z"
                  fill="rgb(236 253 245)"
                  stroke="rgb(167 243 208)"
                  strokeWidth="2"
                />
              </svg>
              <div className="pointer-events-none absolute left-1/2 top-[48%] z-[2] w-[146px] -translate-x-1/2 -translate-y-1/2 text-center text-sm font-semibold leading-[1.2] text-emerald-800">
                Its a match!
                <br />
                Data added
                <br />
                to dashboard
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SwipeBucketButton({
  bucket,
  count,
  items,
  isOpen,
  onOpen,
  onClose,
  onMoveBackItem,
}: {
  bucket: SwipeBucket
  count: number
  items: PotentialMatch[]
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onMoveBackItem?: (cardId: string) => void
}) {
  const label = bucket === 'matches' ? 'Matches' : 'Skips'
  const recentItems = useMemo(() => [...items].reverse(), [items])
  const previewItems = recentItems.slice(0, 4)
  const closeTimeoutRef = useRef<number | null>(null)

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const handleOpen = useCallback(() => {
    clearCloseTimeout()
    onOpen()
  }, [clearCloseTimeout, onOpen])

  const handleCloseWithDelay = useCallback(() => {
    clearCloseTimeout()
    if (typeof window === 'undefined') {
      onClose()
      return
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      onClose()
      closeTimeoutRef.current = null
    }, 180)
  }, [clearCloseTimeout, onClose])

  useEffect(() => clearCloseTimeout, [clearCloseTimeout])

  return (
    <div
      className="relative"
      onMouseEnter={handleOpen}
      onMouseLeave={handleCloseWithDelay}
      onFocus={handleOpen}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null
        if (event.currentTarget.contains(next)) {
          return
        }
        handleCloseWithDelay()
      }}
    >
      <button
        aria-controls={`${bucket}-popover`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
          bucket === 'matches'
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'
        }`}
        type="button"
      >
        {count} {label.toLowerCase()}
      </button>

      {isOpen ? (
        <div
          className={`absolute bottom-full z-[80] mb-2 w-[360px] rounded-xl border border-slate-200 bg-white p-3 shadow-2xl ${
            bucket === 'matches' ? 'left-0' : 'right-0'
          }`}
          id={`${bucket}-popover`}
          onMouseEnter={handleOpen}
          onMouseLeave={handleCloseWithDelay}
          onFocus={handleOpen}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null
            if (event.currentTarget.contains(next)) {
              return
            }
            handleCloseWithDelay()
          }}
          role="dialog"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label} visualizations
          </p>
          {previewItems.length === 0 ? (
            <p className="text-sm text-slate-500">No items yet.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {previewItems.map((card) => (
                <div
                  key={`${bucket}-${card.id}`}
                  className="rounded-lg border border-slate-100 p-2"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {card.title}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {card.chartType} • {card.datasetName}
                      </p>
                    </div>
                    {bucket === 'skips' && onMoveBackItem ? (
                      <button
                        className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                        onClick={() => {
                          clearCloseTimeout()
                          onMoveBackItem(card.id)
                        }}
                        type="button"
                      >
                        Move back
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {recentItems.length > previewItems.length ? (
            <p className="mt-2 text-xs text-slate-500">
              Showing {previewItems.length} of {recentItems.length}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function MatchProfile({
  card,
  summaryState,
}: {
  card: PotentialMatch
  summaryState?: ChartSummaryState
}) {
  const displaySlots = card.slots.filter(
    (slot) => !slot.name.toLowerCase().includes('color'),
  )
  const summaryText = (() => {
    if (!summaryState || summaryState.status === 'idle') {
      return 'Generating AI summary...'
    }

    if (summaryState.status === 'loading') {
      return summaryState.text || 'Generating AI summary...'
    }

    if (summaryState.status === 'error') {
      return summaryState.text || 'AI summary unavailable for this widget.'
    }

    return summaryState.text
  })()

  return (
    <section className="profile-shell rounded-2xl p-4">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Data profile</h3>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="profile-label">Title</p>
          <p className="profile-value">{card.title}</p>
          <p className="profile-label mt-3">Chart type</p>
          <p className="profile-value">{card.chartType}</p>
          <p className="profile-label mt-3">Dataset</p>
          <p className="profile-value break-all">{card.datasetName}</p>
        </div>
        <div>
          <p className="profile-label">Slots</p>
          <ul className="space-y-2">
            {displaySlots.map((slot) => (
              <li key={`${card.id}-${slot.name}`} className="profile-value">
                <span className="font-semibold">{slot.name}:</span>{' '}
                {slot.content.map(slotValueLabel).join(', ') || 'No fields'}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        {summaryText}
      </p>
    </section>
  )
}

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
  const topCardResizeObserverRef = useRef<ResizeObserver | null>(null)
  const topCardResizeRafRef = useRef<number | null>(null)
  const [discoverStackHeight, setDiscoverStackHeight] = useState(760)
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeFeedback>(null)
  const [showSwipeFeedback, setShowSwipeFeedback] = useState(false)
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

    const requiredTypes = ['bar-chart', 'column-chart']
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
      setDiscoverStackHeight((previous) =>
        Math.abs(previous - nextHeight) > 12 ? nextHeight : previous,
      )
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
      const detailItems = isRecord((event as CustomEvent).detail)
        ? (event as CustomEvent).detail.items
        : undefined
      const candidateItems = Array.isArray(detailItems)
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
    return () => {
      grid.removeEventListener('luzmo-item-grid-changed', handleGridChanged)
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
      if (action === 'delete') {
        const deletedId =
          typeof detail.deletedId === 'string' && detail.deletedId.trim().length > 0
            ? detail.deletedId
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

      const itemId = typeof detail.id === 'string' ? detail.id : ''
      if (!itemId) {
        return
      }

      const itemFromState = dashboardGridItems.find((item) => item.id === itemId)
      const itemType =
        typeof detail.type === 'string'
          ? detail.type
          : itemFromState?.type ?? ''
      if (!itemType) {
        return
      }

      const itemOptions = isRecord(detail.options)
        ? stripThemeFromOptions(detail.options as Record<string, unknown>)
        : stripThemeFromOptions(itemFromState?.options ?? {})
      const itemSlots = Array.isArray(detail.slots)
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
    panel.customOptionsConfiguration = itemEditorOptionsConfig
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

            const shouldRetry = response.status === 429 || response.status >= 500
            if (shouldRetry && attempt < maxAttempts) {
              await waitWithAbort(
                controller.signal,
                retryDelayMs[attempt - 1] ?? retryDelayMs[retryDelayMs.length - 1],
              )
              continue
            }
          }
        }

        if (!response.ok) {
          lastErrorMessage =
            lastErrorMessage ||
            `AI summary request failed (${response.status}).`
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
                        dragElastic={0.8}
                        dragSnapToOrigin={!isSwipingOut}
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





