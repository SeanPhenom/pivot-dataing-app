import type { AccessibleDashboard } from '@luzmo/embed'
import type { SlotConfig } from '@luzmo/dashboard-contents-types/src/lib/shared/types/slots'
import type { OptionsConfig } from '@luzmo/dashboard-contents-types/src/lib/shared/utils/options-config.types'

export type Screen = 'profile' | 'discover' | 'dashboard'
export type SwipeDirection = 'left' | 'right'
export type SwipeBucket = 'matches' | 'skips'
export type SwipeFeedback = 'match' | 'no-match' | null

export type DashboardChoice = {
  id: string
  name: string
}

export type VizSlotContent = {
  datasetId?: string
  columnId?: string
  formulaId?: string
  level?: number
  [key: string]: unknown
}

export type VizSlot = {
  name: string
  content: VizSlotContent[]
}

export type PotentialMatch = {
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

export type SavedConnection = {
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

export type ChartSummaryStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ChartSummaryState = {
  status: ChartSummaryStatus
  text: string
}

export type AiModalStage = 'entry' | 'create'
export type CreateMatchMode = 'builder' | 'ai'

export type IqChatMessage = {
  role: 'user' | 'assistant'
  text: string
}

export type DashboardProbeElement = HTMLElement & {
  authKey?: string
  authToken?: string
  getAccessibleDashboards?: () => Promise<AccessibleDashboard[]>
}

export type VizItemElement = HTMLElement & {
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

export type SlotPickerPanelElement = HTMLElement & {
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

export type ItemOptionPanelElement = HTMLElement & {
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

export type LuzmoGridItem = {
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

export type LuzmoGridElement = HTMLElement & {
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

export type DashboardItemRaw = {
  id?: string
  type?: string
  options?: Record<string, unknown>
  slots?: unknown
}

export type DashboardViewRaw = {
  screenModus?: string
  items?: DashboardItemRaw[]
}

export type DashboardRowRaw = {
  id?: string
  name?: unknown
  contents?: {
    views?: DashboardViewRaw[]
  }
}

export type DashboardSecurableResponse = {
  rows?: DashboardRowRaw[]
  count?: number
  message?: string
}

export type MatchPersonaKey = 'caveman' | 'business' | 'data-engineer' | 'other'
export type ColumnTypeKey = 'hierarchy' | 'datetime' | 'currency' | 'numeric' | 'text'
