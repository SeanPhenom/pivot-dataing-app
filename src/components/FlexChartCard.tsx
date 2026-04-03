import { useEffect, useRef, useState } from 'react'
import type { PotentialMatch, SwipeFeedback, VizItemElement } from '../types'
import {
  LUZMO_AUTH_KEY,
  LUZMO_AUTH_TOKEN,
  LUZMO_APP_SERVER,
  LUZMO_API_HOST,
} from '../utils/constants'
import { withPivotPreviewTheme, getItemDataRows } from '../utils/helpers'

export function FlexChartCard({
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
  const [trackedCardId, setTrackedCardId] = useState('')

  if (trackedCardId !== card.id) {
    setTrackedCardId(card.id)
    setIsVizReady(false)
  }

  useEffect(() => {
    onChartDataReadyRef.current = onChartDataReady
  }, [onChartDataReady])

  useEffect(() => {
    const mount = vizMountRef.current
    if (!mount) {
      return
    }
    let isUnmounted = false

    const viz = document.createElement('luzmo-embed-viz-item') as VizItemElement
    const vizOptions = withPivotPreviewTheme(card.options ?? {}, theme)
    viz.style.width = '100%'
    viz.style.height = '100%'
    viz.style.display = 'block'
    viz.style.pointerEvents = 'auto'

    viz.authKey = LUZMO_AUTH_KEY
    viz.authToken = LUZMO_AUTH_TOKEN
    viz.appServer = LUZMO_APP_SERVER
    viz.apiHost = LUZMO_API_HOST
    const sourceItemId =
      typeof card.sourceItemId === 'string' ? card.sourceItemId : ''
    const useItemReference = card.useItemReference ?? false
    const shouldUseReferenceOnly = useItemReference && Boolean(card.sourceDashboardId) && Boolean(sourceItemId)

    if (shouldUseReferenceOnly) {
      viz.dashboardId = card.sourceDashboardId
      viz.itemId = sourceItemId
    } else {
      viz.type = card.vizType
      viz.options = vizOptions
      viz.slots = card.rawSlots ?? []
    }

    viz.setAttribute('authKey', LUZMO_AUTH_KEY)
    viz.setAttribute('authToken', LUZMO_AUTH_TOKEN)
    viz.setAttribute('appServer', LUZMO_APP_SERVER)
    viz.setAttribute('apiHost', LUZMO_API_HOST)
    if (shouldUseReferenceOnly) {
      viz.setAttribute('dashboardId', card.sourceDashboardId as string)
      viz.setAttribute('itemId', sourceItemId)
    } else {
      viz.setAttribute('type', card.vizType)
      viz.setAttribute('options', JSON.stringify(vizOptions))
      viz.setAttribute('slots', JSON.stringify(card.rawSlots ?? []))
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
