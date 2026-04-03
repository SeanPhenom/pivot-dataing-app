import type { PotentialMatch, ChartSummaryState } from '../types'
import { slotValueLabel } from '../utils/helpers'

export function MatchProfile({
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
