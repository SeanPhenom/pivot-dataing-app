import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { SwipeBucket, PotentialMatch } from '../types'

export function SwipeBucketButton({
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
