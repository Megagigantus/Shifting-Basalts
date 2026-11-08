// DM screen: the run in progress. Every button runs one step from
// rules/runFlow.ts, then saves the new state.
import { useState } from 'react'
import type { Character } from '../model/character'
import type { RunResult, RunState } from '../model/run'
import { floorInfo, LAST_FLOOR, lootKeptPercent, PRESSURES } from '../rules/run'
import { canExtract, clearRoom, defeatBoss, descend, extract, isBossRoom, markDead, pass } from '../rules/runFlow'
import { cancelRun, saveRunState } from '../runStore'

const ROOM_LABELS = { combat: 'Combat', elite: 'Elite', reprieve: 'Reprieve', boss: 'Boss' }

interface Props {
  state: RunState
  characters: Character[]
  onEnded: (results: RunResult[], state: RunState) => void
}

export function RunTracker({ state, characters, onEnded }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { run, players } = state
  const floor = floorInfo(run.floor)
  const bossRoom = isBossRoom(state)

  /** Run one step and save it. Steps throw if they aren't allowed right now. */
  async function act(step: (s: RunState) => RunState, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setError(null)
    let next: RunState
    try {
      next = step(state)
    } catch (err) {
      setError((err as Error).message)
      return
    }
    setBusy(true)
    try {
      const results = await saveRunState(next, state, characters)
      if (results) onEnded(results, next)
    } catch {
      setError('Could not save. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    const sure = window.confirm(
      'Cancel this run? It will be deleted and nobody gets any rewards, Devotions or lockouts from it.',
    )
    if (!sure) return
    setBusy(true)
    try {
      await cancelRun(state)
    } catch {
      setError('Could not cancel the run.')
      setBusy(false)
    }
  }

  const where = run.awaitingChoice
    ? `Floor ${run.floor} boss defeated`
    : bossRoom
      ? run.floor === LAST_FLOOR
        ? 'Floor 5: the legendary boss'
        : `Floor ${run.floor}: boss room`
      : `Floor ${run.floor}: room ${run.room} of ${floor.rooms}`

  return (
    <div className="run-tracker">
      <div className="run-header">
        <div>
          <div className="run-where">{where}</div>
          <div className="hint">
            Hazard class {floor.hazard} · party level {run.partyLevel} · rewards ×{run.entryMultiplier}
            {run.pressureBonusPercent > 0 && ` · Pressures +${run.pressureBonusPercent}%`}
          </div>
          {run.pressures.length > 0 && (
            <div className="hint">
              Pressures: {run.pressures.map((id) => PRESSURES.find((p) => p.id === id)?.name ?? id).join(', ')}
            </div>
          )}
        </div>
        <div className="join-code" title="Players will use this code to join (Phase 2)">
          <span className="hint">Join code</span>
          <strong>{run.joinCode}</strong>
        </div>
      </div>

      <p className="hint">
        Loot kept if the party extracts now: {canExtract(state) ? `${lootKeptPercent(run.lastBossFloor)}%` : 'extraction opens after a boss'}
      </p>

      <div className="run-actions">
        {run.awaitingChoice ? (
          <>
            {run.floor < LAST_FLOOR && (
              <button type="button" disabled={busy} onClick={() => act(descend)}>
                Descend to floor {run.floor + 1}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(extract, `Extract now? The party keeps ${lootKeptPercent(run.lastBossFloor)}% of its loot and the run ends.`)
              }
            >
              Extract (keep {lootKeptPercent(run.lastBossFloor)}%)
            </button>
          </>
        ) : bossRoom ? (
          <button type="button" disabled={busy} onClick={() => act(defeatBoss)}>
            Boss defeated
          </button>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => act((s) => clearRoom(s, 'combat'))}>
              Combat room cleared
            </button>
            <button type="button" disabled={busy} onClick={() => act((s) => clearRoom(s, 'elite'))}>
              Elite room cleared
            </button>
            <button type="button" disabled={busy} onClick={() => act((s) => clearRoom(s, 'reprieve'))}>
              Reprieve room
            </button>
          </>
        )}
      </div>

      <table className="party-table">
        <thead>
          <tr>
            <th>Player</th>
            <th title="Devotions earned this run">Devotions</th>
            <th title="Boss Quantum Basalts, before Pressure bonuses. Lost on death.">QB earned</th>
            <th title="Quantum Basalts from passing. Kept even on death.">QB passed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.characterId} className={p.alive ? '' : 'fallen'}>
              <td>
                {p.name}
                {!p.alive && (
                  <div className="warning">
                    Fell on floor {p.diedOnFloor} · locked out {p.lockoutDays} days ({p.lockoutRolls?.join(' + ')})
                  </div>
                )}
              </td>
              <td>{p.devotions}</td>
              <td>{p.alive ? p.quantumBasaltsEarned : `${p.quantumBasaltsEarned} (forfeit)`}</td>
              <td>{p.quantumBasaltsPassed}</td>
              <td className="row-actions">
                {p.alive && (
                  <>
                    <button type="button" disabled={busy} onClick={() => act((s) => pass(s, p.characterId))}>
                      Pass
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        act(
                          (s) => markDead(s, p.characterId),
                          `Mark ${p.name} as dead? They're expelled, lose this run's boss Quantum Basalts and get locked out ${run.floor}d4 days.`,
                        )
                      }
                    >
                      Died
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {run.log.length > 0 && (
        <details className="run-log">
          <summary>Rooms cleared ({run.log.length})</summary>
          <ol>
            {run.log.map((entry, i) => (
              <li key={i}>
                Floor {entry.floor}, {entry.kind === 'boss' ? 'boss' : `room ${entry.room}`}: {ROOM_LABELS[entry.kind]}
              </li>
            ))}
          </ol>
        </details>
      )}

      {error && <p className="error">{error}</p>}

      <div className="run-footer">
        <button type="button" className="quiet" disabled={busy} onClick={cancel}>
          Cancel run
        </button>
      </div>
    </div>
  )
}
