// DM screen: the Run tab. Shows the run in progress, the summary of a run
// that just ended, or the lobby to start a new one.
import { useState } from 'react'
import { Flag, Skull, Trophy } from 'lucide-react'
import type { RunResult, RunState } from '../model/run'
import { itemName } from '../rules/loot'
import { useActiveRun } from '../runStore'
import { useCharacters } from '../useCharacters'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { PRIMARY_BUTTON } from '../ui/styles'
import { RunTracker } from './RunTracker'
import { StartRun } from './StartRun'

export function RunPanel() {
  const { state, loading, error } = useActiveRun(true)
  const { characters } = useCharacters()
  const [ended, setEnded] = useState<{ results: RunResult[]; state: RunState } | null>(null)

  return (
    <div className="mt-6 flex flex-col gap-4">
      {loading && <p className="text-sm text-stone-400">Loading…</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {state && characters && (
        <RunTracker
          state={state}
          characters={characters}
          onEnded={(results, endedState) => setEnded({ results, state: endedState })}
        />
      )}

      {!state && ended && <RunSummary {...ended} onDone={() => setEnded(null)} />}

      {!state && !ended && !loading && characters && <StartRun characters={characters} />}
    </div>
  )
}

function RunSummary({ results, state, onDone }: { results: RunResult[]; state: RunState; onDone: () => void }) {
  const { run } = state
  const wiped = run.status === 'wiped'
  const headline = wiped
    ? `Wipe on floor ${run.floor}. The party's loot is lost.`
    : run.lastBossFloor === 5
      ? 'Full clear! The party keeps all of its loot.'
      : `Extracted after the floor ${run.lastBossFloor} boss. The party keeps ${run.lootKeptPercent}% of its loot.`

  return (
    <Panel
      hero
      tone={wiped ? 'rose' : 'emerald'}
      icon={wiped ? <Skull size={16} /> : run.lastBossFloor === 5 ? <Trophy size={16} /> : <Flag size={16} />}
      title="Run over"
      subtitle={headline}
      actions={
        <button type="button" onClick={onDone} className={PRIMARY_BUTTON}>
          Done
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {results.map((r) => (
          <div key={r.characterId} className="flex flex-col gap-2 rounded-xl border border-stone-800 bg-stone-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-stone-100">{r.name}</span>
              {r.survived ? <Pill tone="emerald">Made it out</Pill> : <Pill tone="rose">Fell on floor {r.deepestFloor}</Pill>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="purple" mono>
                +{r.quantumBasaltsGained} QB
              </Pill>
              <Pill tone="indigo" mono>
                +{r.devotions} Devotions
              </Pill>
              {!r.survived && <Pill tone="rose">Locked out {r.lockoutDays} days</Pill>}
            </div>
            <p className="m-0 text-[11px] text-stone-400">
              Loot: {(r.loot ?? []).map((i) => itemName(i)).join(', ') || 'none'}
            </p>
          </div>
        ))}
      </div>
      {run.lootShare && run.lootShare.creditsPayout > 0 && (
        <p className="m-0 text-sm text-stone-300">
          Credits to hand out: <strong className="text-amber-300">{run.lootShare.creditsPayout.toLocaleString()}</strong> (the
          kept value the party didn't take as items).
        </p>
      )}
      <p className="m-0 text-[11px] text-stone-500">These have been added to each character's saved record.</p>
    </Panel>
  )
}
