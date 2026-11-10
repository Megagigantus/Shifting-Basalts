// Past runs (design bible: App requirements > Characters, "run history").
// The DM sees every run; players see the runs their characters were in.
import { useState } from 'react'
import { itemName } from '../rules/loot'
import { PRESSURES } from '../rules/run'
import { useRunHistory, type RunHistoryEntry } from '../runStore'

function outcome(e: RunHistoryEntry): string {
  if (e.status === 'wiped') return `Wiped on floor ${e.floorReached}`
  if (e.lastBossFloor >= 5) return 'Full clear'
  return `Extracted after the floor ${e.lastBossFloor} boss (kept ${e.lootKeptPercent ?? 0}%)`
}

const when = (d: Date | null) =>
  d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'just now'

interface Props {
  /** Only show runs these characters were in (players). Leave out for every run (DM). */
  characterIds?: string[]
  title?: string
}

export function RunHistory({ characterIds, title = 'Run history' }: Props) {
  const { entries, error } = useRunHistory()
  const [open, setOpen] = useState<string | null>(null)
  const shown = (entries ?? []).filter(
    (e) => !characterIds || e.results.some((r) => characterIds.includes(r.characterId)),
  )
  return (
    <section className="panel">
      <h2>{title}</h2>
      {entries === null && !error && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}
      {entries && shown.length === 0 && <p className="hint">No finished runs yet.</p>}
      <ul className="plain-list history-list">
        {shown.map((e) => (
          <li key={e.id} className="history-entry">
            <button type="button" className="link" onClick={() => setOpen(open === e.id ? null : e.id)}>
              {when(e.endedAt)}: {outcome(e)}
            </button>{' '}
            <span className="hint">
              {e.results.map((r) => r.name).join(', ')} · party level {e.partyLevel}
            </span>
            {open === e.id && <HistoryDetails entry={e} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function HistoryDetails({ entry: e }: { entry: RunHistoryEntry }) {
  return (
    <div className="history-details">
      <p className="hint">
        {e.pressures.length
          ? `Pressures: ${e.pressures.map((id) => PRESSURES.find((p) => p.id === id)?.name ?? id).join(', ')}`
          : 'No Pressures'}{' '}
        · {e.rooms.length} rooms cleared, deepest floor {e.floorReached}
      </p>
      <table className="party-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Quantum Basalts</th>
            <th>Devotions</th>
            <th>Loot</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {e.results.map((r) => (
            <tr key={r.characterId}>
              <td>{r.name}</td>
              <td>+{r.quantumBasaltsGained}</td>
              <td>+{r.devotions}</td>
              <td>{(r.loot ?? []).map((i) => itemName(i)).join(', ') || 'none'}</td>
              <td>{r.survived ? 'Made it out' : `Fell on floor ${r.deepestFloor}, locked out ${r.lockoutDays} days`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {e.lootShare && (
        <p className="hint">
          Kept {e.lootShare.keptPercent}%: {e.lootShare.keptValue.toLocaleString()} credits of value, of which{' '}
          {e.lootShare.creditsPayout.toLocaleString()} was paid out in credits.
        </p>
      )}
    </div>
  )
}
