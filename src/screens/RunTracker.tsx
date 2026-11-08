// DM screen: the run in progress. Every button runs one step from
// rules/runFlow.ts, then saves the new state.
import { Fragment, useState } from 'react'
import type { Character } from '../model/character'
import type { RunResult, RunState } from '../model/run'
import { floorInfo, LAST_FLOOR, PRESSURES } from '../rules/run'
import {
  canExtract,
  clearRoom,
  defeatBoss,
  descend,
  extract,
  isBossRoom,
  lootKeptIfExtracting,
  markDead,
  pass,
} from '../rules/runFlow'
import { cancelRun, saveRunState } from '../runStore'
import { boonSummary } from '../rules/boons'
import { PlayerBoons } from './PlayerBoons'

const ROOM_LABELS = { combat: 'Combat', elite: 'Elite', reprieve: 'Reprieve', boss: 'Boss' }

interface Props {
  state: RunState
  characters: Character[]
  onEnded: (results: RunResult[], state: RunState) => void
}

export function RunTracker({ state, characters, onEnded }: Props) {
  const [busy, setBusy] = useState(false)
  // Which player's boon panel is open, if any.
  const [boonsFor, setBoonsFor] = useState<string | null>(null)
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
            {(run.extraPressuresBonusPercent ?? 0) > 0 && ` · Extra Pressures +${run.extraPressuresBonusPercent}%`}
            {(run.deepPocketsPercent ?? 0) > 0 && ` · Deep Pockets +${run.deepPocketsPercent}% loot kept`}
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
        Loot kept if the party extracts now: {canExtract(state) ? `${lootKeptIfExtracting(state)}%` : 'extraction opens after a boss'}
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
                act(extract, `Extract now? The party keeps ${lootKeptIfExtracting(state)}% of its loot and the run ends.`)
              }
            >
              Extract (keep {lootKeptIfExtracting(state)}%)
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
            <Fragment key={p.characterId}>
            <tr className={p.alive ? '' : 'fallen'}>
              <td>
                {p.name}
                {boonSummary(p.slots, p.hiddenBoonId) && (
                  <div className="hint">{boonSummary(p.slots, p.hiddenBoonId)}</div>
                )}
                {!p.alive && (
                  <div className="warning">
                    Fell on floor {p.diedOnFloor} · locked out {p.lockoutDays} days (rolled{' '}
                    {p.lockoutRolls?.join(' + ')}
                    {(p.quickReturnDays ?? 0) > 0 && `, Quick Return −${p.quickReturnDays}, minimum 1`})
                  </div>
                )}
              </td>
              <td>{p.devotions}</td>
              <td>{p.alive ? p.quantumBasaltsEarned : `${p.quantumBasaltsEarned} (forfeit)`}</td>
              <td>{p.quantumBasaltsPassed}</td>
              <td className="row-actions">
                {p.alive && (
                  <>
                    <button
                      type="button"
                      onClick={() => setBoonsFor(boonsFor === p.characterId ? null : p.characterId)}
                    >
                      {boonsFor === p.characterId ? 'Hide boons' : 'Boons'}
                    </button>
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
            {p.alive && boonsFor === p.characterId && (
              <tr className="boons-row">
                <td colSpan={5}>
                  <PlayerBoons
                    player={p}
                    character={characters.find((c) => c.id === p.characterId)}
                    busy={busy}
                    act={act}
                  />
                </td>
              </tr>
            )}
            </Fragment>
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
