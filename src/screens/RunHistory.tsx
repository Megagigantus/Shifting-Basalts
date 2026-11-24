// Past runs (design bible: App requirements > Characters, "run history").
// The DM sees every run; players see the runs their characters were in.
import { useState } from 'react'
import { ChevronDown, ChevronRight, ClockArrowLeft } from 'lucide-react'
import { PRESSURES } from '../rules/run'
import { deleteRunHistory, useRunHistory, type RunHistoryEntry } from '../runStore'
import { ConfirmButton } from '../ui/ConfirmButton'
import { LootNames } from '../ui/LootNames'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { cx, type Tone } from '../ui/tone'

function outcome(e: RunHistoryEntry): { text: string; tone: Tone } {
  if (e.status === 'wiped') return { text: `Wiped on floor ${e.floorReached}`, tone: 'rose' }
  if (e.lastBossFloor >= 5) return { text: 'Full clear', tone: 'amber' }
  return { text: `Extracted after the floor ${e.lastBossFloor} boss (kept ${e.lootKeptPercent ?? 0}%)`, tone: 'emerald' }
}

const when = (d: Date | null) =>
  d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'just now'

interface Props {
  /** Only show runs these characters were in (players). Leave out for every run (DM). */
  characterIds?: string[]
  title?: string
  /** DM only: show a Delete button on each run. */
  canDelete?: boolean
}

export function RunHistory({ characterIds, title = 'Run history', canDelete = false }: Props) {
  const { entries, error } = useRunHistory()
  const [open, setOpen] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const remove = (id: string) => {
    setDeleteError(null)
    deleteRunHistory(id).catch(() => setDeleteError('Could not delete that run. Try again.'))
  }
  const shown = (entries ?? []).filter((e) => !characterIds || e.results.some((r) => characterIds.includes(r.characterId)))
  return (
    <Panel className="mt-6" icon={<ClockArrowLeft size={15} />} title={title}>
      {entries === null && !error && <p className="m-0 text-sm text-stone-400">Loading…</p>}
      {error && <p className="m-0 text-sm text-rose-300">{error}</p>}
      {deleteError && <p className="m-0 text-sm text-rose-300">{deleteError}</p>}
      {entries && shown.length === 0 && <p className="m-0 text-xs text-stone-500">No finished runs yet.</p>}
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {shown.map((e) => {
          const o = outcome(e)
          const isOpen = open === e.id
          return (
            <li key={e.id} className="rounded-lg border border-stone-800 bg-stone-950/60">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : e.id)}
                className="flex w-full cursor-pointer flex-wrap items-center gap-2 border-0 bg-transparent p-2.5 text-left"
              >
                {isOpen ? <ChevronDown size={14} className="text-stone-400" /> : <ChevronRight size={14} className="text-stone-400" />}
                <span className="font-mono text-[0.6875rem] text-stone-400">{when(e.endedAt)}</span>
                <Pill tone={o.tone}>{o.text}</Pill>
                <span className="min-w-0 flex-1 truncate text-xs text-stone-300">
                  {e.results.map((r) => r.name).join(', ')} · party level {e.partyLevel}
                </span>
              </button>
              {isOpen && <HistoryDetails entry={e} onDelete={canDelete ? () => remove(e.id) : undefined} />}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function HistoryDetails({ entry: e, onDelete }: { entry: RunHistoryEntry; onDelete?: () => void }) {
  return (
    <div className="flex flex-col gap-2 border-t border-stone-800 p-2.5">
      <div className="flex flex-wrap gap-1.5">
        {e.pressures.length ? (
          e.pressures.map((id) => (
            <Pill key={id} tone="rose">
              {PRESSURES.find((p) => p.id === id)?.name ?? id}
            </Pill>
          ))
        ) : (
          <Pill>No Pressures</Pill>
        )}
        <Pill>{e.rooms.length} rooms cleared</Pill>
        <Pill>Deepest floor {e.floorReached}</Pill>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {e.results.map((r) => (
          <div key={r.characterId} className={cx('flex flex-col gap-1 rounded-lg border p-2', r.survived ? 'border-stone-800' : 'border-rose-500/30')}>
            <div className="flex flex-wrap items-center gap-1.5">
              <strong className="mr-auto text-xs text-stone-100">{r.name}</strong>
              <Pill tone="purple" mono>
                +{r.quantumBasaltsGained} Quantum Basalts
              </Pill>
              <Pill tone="indigo" mono>
                +{r.devotions} Dev
              </Pill>
            </div>
            <span className={cx('text-[0.6875rem]', r.survived ? 'text-emerald-300' : 'text-rose-300')}>
              {r.survived ? 'Made it out' : `Fell on floor ${r.deepestFloor}, locked out ${r.lockoutDays} days`}
            </span>
            <span className="text-[0.6875rem] text-stone-400">
              Loot: <LootNames items={r.loot} />
            </span>
          </div>
        ))}
      </div>
      {e.lootShare && (
        <p className="m-0 text-[0.6875rem] text-stone-500">
          Kept {e.lootShare.keptPercent}%: {e.lootShare.keptValue.toLocaleString()} credits of value, of which{' '}
          {e.lootShare.creditsPayout.toLocaleString()} was paid out in credits.
        </p>
      )}
      {onDelete && (
        <div className="flex flex-wrap items-center gap-2 border-t border-stone-800 pt-2">
          <span className="mr-auto text-[0.6875rem] text-stone-500">
            Deleting removes this record only. Basalts, Devotions, loot and lockouts already given stay with the characters.
          </span>
          <ConfirmButton confirmLabel="Yes, delete this run's history" onConfirm={onDelete}>
            Delete
          </ConfirmButton>
        </div>
      )}
    </div>
  )
}
