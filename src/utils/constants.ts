import type { MatchPersonaKey, ColumnTypeKey } from '../types'

export const LUZMO_AUTH_KEY = import.meta.env.VITE_LUZMO_AUTH_KEY ?? ''
export const LUZMO_AUTH_TOKEN = import.meta.env.VITE_LUZMO_AUTH_TOKEN ?? ''
export const LUZMO_API_HOST =
  import.meta.env.VITE_LUZMO_API_HOST ?? 'https://api.luzmo.com'
export const LUZMO_APP_SERVER =
  import.meta.env.VITE_LUZMO_APP_SERVER ?? 'https://app.luzmo.com'

export const PERSONAS = [
  'Caveman: Big Number Big Happy',
  'Boomer: Where the F@c$ is my CSV Export?',
  'Business user: I need this chart for my Quarterly Business Review',
  'Data Engineer: SQL is my love language',
]

export const BOOMER_PERSONA_PREFIX = 'boomer:'
export const CAVEMAN_PERSONA_PREFIX = 'caveman:'
export const BUSINESS_PERSONA_PREFIX = 'business user:'
export const DATA_ENGINEER_PERSONA_PREFIX = 'data engineer:'

export const EXCLUDED_ITEM_TYPES = new Set([
  'spacer',
  'text',
  'image',
  'video',
  'iframeobject',
  'dynamic-imageobject',
])

export const CONTROL_WIDGET_TYPE_KEYWORDS = ['filter', 'control', 'selector']
export const AI_SUMMARY_MAX_ROWS = 100
export const AI_SUMMARY_UNSUPPORTED_TYPE_KEYWORDS = [
  'number',
  ...CONTROL_WIDGET_TYPE_KEYWORDS,
]

export const DASHBOARD_EDIT_ITEM_ACTIONS_MENU = [
  { type: 'group' as const, actions: ['item-options', 'delete'] },
]

export const SAVED_CONNECTIONS_STORAGE_KEY = 'pivot-copy.saved-connections.v1'
export const ACTIVE_CONNECTION_STORAGE_KEY = 'pivot-copy.active-connection-id.v1'

export const AISUMMARY_BUCKET_SIZE = 10
export const AISUMMARY_BUCKET_REFILL = 0.016
export const AISUMMARY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const AISUMMARY_CACHE_PREFIX = 'pivot.aisummary.'

export const SWIPE_FEEDBACK_VISIBLE_MS = 1150
export const SWIPE_FEEDBACK_CLEAR_DELAY_MS = 1450
export const SWIPE_CARD_EXIT_MS = 220

export const REALISM_PERSONA_BASE_CHANCE: Record<MatchPersonaKey, number> = {
  caveman: 0.4,
  business: 0.6,
  'data-engineer': 0.8,
  other: 0.55,
}
export const REALISM_MATCH_STRICTNESS = 0.78
export const REALISM_MAX_MATCH_CHANCE = 0.84

export const COLUMN_TYPE_BADGES: Record<
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

export const PIVOT_THEME = buildPivotTheme(
  'pivot-signature',
  ['#0f766e', '#14b8a6', '#0d9488', '#10b981', '#22c55e', '#84cc16', '#64748b', '#0f172a'],
  'rgb(15, 23, 42)',
)
