// DM screen: the run area at the top of the page. Shows the run in progress,
// the summary of a run that just ended, or a button to start a new one.
import { useState } from 'react'
import type { RunResult, RunState } from '../model/run'
import { useActiveRun } from '../runStore'
import { useCharacters } from '../useCharacters'
import { RunTracker } from './RunTracker'
import { StartRun } from './StartRun'

export function RunPanel() {
  const { state, loading, error } = useActiveRun()
  const { characters } = useCharacters()
  const [starting, setStarting] = useState(false)
  const [ended, setEnded] = useState<{ results: RunResult[]; state: RunState } | null>(null)

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Run</h2>
        {!state && !ended && !starting && !loading && (
          <button type="button" onClick={() => setStarting(true)} disabled={!characters}>
            Start a run
          </button>
        )}
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}

      {state && characters && (
        <RunTracker
          state={state}
          characters={characters}
          onEnded={(results, endedState) => setEnded({ results, state: endedState })}
        />
      )}

      {!state && ended && <RunSummary {...ended} onDone={() => setEnded(null)} />}

      {!state && !ended && starting && characters && (
        <StartRun
          characters={characters}
          onStarted={() => setStarting(false)}
          onCancel={() => setStarting(false)}
        />
      )}

      {!state && !ended && !starting && !loading && (
        <p className="hint">No run in progress.</p>
      )}
    </section>
  )
}

function RunSummary({ results, state, onDone }: { results: RunResult[]; state: RunState; onDone: () => void }) {
  const { run } = state
  const headline =
    run.status === 'wiped'
      ? `Wipe on floor ${run.floor}. The party's loot is lost.`
      : run.lastBossFloor === 5
        ? 'Full clear! The party keeps all of its loot.'
        : `Extracted after the floor ${run.lastBossFloor} boss. The party keeps ${run.lootKeptPercent}% of its loot.`

  return (
    <div className="run-summary">
      <p className="run-where">{headline}</p>
      <table className="party-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Quantum Basalts</th>
            <th>Devotions</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.characterId}>
              <td>{r.name}</td>
              <td>+{r.quantumBasaltsGained}</td>
              <td>+{r.devotions}</td>
              <td>{r.survived ? 'Made it out' : `Fell on floor ${r.deepestFloor}, locked out ${r.lockoutDays} days`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">These have been added to each character's saved record.</p>
      <button type="button" onClick={onDone}>
        Done
      </button>
    </div>
  )
}
