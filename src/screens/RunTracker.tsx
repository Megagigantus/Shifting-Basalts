// DM screen: the run in progress. Every button runs one step from
// rules/runFlow.ts or rules/draftFlow.ts, then saves the new state. While
// open, it also applies players' draft choices sent from their devices.
import { Fragment, useEffect, useRef, useState } from 'react'
import type { Character } from '../model/character'
import type { RoomKind, RunResult, RunState } from '../model/run'
import { floorInfo, LAST_FLOOR, PRESSURES, passQuantumBasalts } from '../rules/run'
import {
  canExtract,
  descend,
  isBossRoom,
  lootKeptIfExtracting,
  markDead,
  waitingOn,
} from '../rules/runFlow'
import { classTriggerMet, rerollsLeft } from '../rules/draftFlow'
import { finishRoom } from '../rules/progress'
import { DmLootPanel, ExtractPanel, VaultPanel } from './LootScreens'
import { RecoveryPanel } from './RecoveryPanel'
import { useLootRequests } from '../runStore'
import { applyChoice } from '../rules/draftChoice'
import { classHiddenBoon } from '../rules/draft'
import { applyChoiceDoc, cancelRun, saveRunState, useChoices } from '../runStore'
import { boonSummary } from '../rules/boons'
import { PlayerBoons } from './PlayerBoons'
import { DraftOffers } from './DraftOffers'
import { ForgePanel } from './ForgePanel'
import { DmRoom } from './DmRoom'
import { startFloor } from '../rules/roomFlow'
import { forgeUsesLeft, spendForge } from '../rules/forge'

const ROOM_LABELS = { combat: 'Combat', elite: 'Elite', reprieve: 'Reprieve', boss: 'Boss' }

interface Props {
  state: RunState
  characters: Character[]
  onEnded: (results: RunResult[], state: RunState) => void
}

export function RunTracker({ state, characters, onEnded }: Props) {
  const [busy, setBusy] = useState(false)
  // Which player's boons or draft panel is open, if any.
  const [open, setOpen] = useState<{ id: string; kind: 'boons' | 'draft' } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const { run, players } = state
  const requests = useLootRequests(run.id)
  const floor = floorInfo(run.floor)
  const bossRoom = isBossRoom(state)
  const waiting = waitingOn(state)
  const passValue = passQuantumBasalts(run.entryMultiplier)

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

  /** Clear a room (or beat the boss): its loot, then everyone's draft (or Thils's Vault after the legendary boss). */
  const clearAndDraft = (kind: RoomKind) => act((s) => finishRoom(s, kind, Math.random))
  // The generated room's kind (elite, Reprieve...), when this run has rooms.
  const roomKind = state.dm?.room?.kind ?? null

  // Apply players' choices as they arrive, one at a time.
  const choices = useChoices(run.id)
  const applying = useRef(false)
  useEffect(() => {
    if (applying.current) return
    const next = Object.entries(choices).find(([, c]) => !c.error)
    if (!next) return
    applying.current = true
    applyChoiceDoc(state, next[0], next[1])
      .catch(() => setError('Could not apply a player\'s choice. Check your connection.'))
      .finally(() => {
        applying.current = false
      })
  }, [choices, state])

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

  const toggle = (id: string, kind: 'boons' | 'draft') =>
    setOpen(open?.id === id && open.kind === kind ? null : { id, kind })

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
        <div className="join-code" title="Players find this run automatically when they sign in">
          <span className="hint">Join code</span>
          <strong>{run.joinCode}</strong>
        </div>
      </div>

      <p className="hint">
        Loot kept if the party extracts now: {canExtract(state) ? `${lootKeptIfExtracting(state)}%` : 'extraction opens after a boss'}
      </p>

      {waiting.length > 0 && (
        <p className="waiting-banner">Waiting on draft picks from {waiting.join(', ')}.</p>
      )}

      <div className="run-actions">
        {run.awaitingChoice ? (
          <>
            {run.floor < LAST_FLOOR && (
              <button
                type="button"
                disabled={busy || waiting.length > 0}
                onClick={() => act((s) => startFloor(descend(s), Math.random))}
              >
                Descend to floor {run.floor + 1}
              </button>
            )}
            <button type="button" disabled={busy || extracting} onClick={() => setExtracting(true)}>
              {run.floor >= LAST_FLOOR ? 'Finish the full clear…' : `Extract (keep ${lootKeptIfExtracting(state)}%)…`}
            </button>
          </>
        ) : bossRoom ? (
          <button type="button" disabled={busy || waiting.length > 0} onClick={() => clearAndDraft('boss')}>
            Boss defeated
          </button>
        ) : roomKind === 'reprieve' ? (
          <button type="button" disabled={busy || waiting.length > 0} onClick={() => clearAndDraft('reprieve')}>
            Take the Reprieve
          </button>
        ) : roomKind ? (
          <button type="button" disabled={busy || waiting.length > 0} onClick={() => clearAndDraft(roomKind)}>
            {roomKind === 'elite' ? 'Elite room cleared' : 'Room cleared'}
          </button>
        ) : (
          <>
            <button type="button" disabled={busy || waiting.length > 0} onClick={() => clearAndDraft('combat')}>
              Combat room cleared
            </button>
            <button type="button" disabled={busy || waiting.length > 0} onClick={() => clearAndDraft('elite')}>
              Elite room cleared
            </button>
            <button type="button" disabled={busy || waiting.length > 0} onClick={() => clearAndDraft('reprieve')}>
              Reprieve room
            </button>
          </>
        )}
      </div>

      {extracting && run.awaitingChoice && (
        <ExtractPanel state={state} busy={busy} act={act} requests={requests} onClose={() => setExtracting(false)} />
      )}

      <VaultPanel state={state} busy={busy} act={act} />

      <DmRoom state={state} busy={busy} act={act} />

      <DmLootPanel state={state} busy={busy} act={act} requests={requests} />

      <ForgePanel
        players={players}
        usesLeft={forgeUsesLeft(state)}
        busy={busy}
        onUse={(characterId, action) => act((s) => spendForge(s, characterId, action))}
      />

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
          {players.map((p) => {
            const character = characters.find((c) => c.id === p.characterId)
            const sent = choices[p.characterId]
            const hasClassBoon = Boolean(p.draftProfile && classHiddenBoon(p.draftProfile.classId))
            return (
              <Fragment key={p.characterId}>
                <tr className={p.alive ? '' : 'fallen'}>
                  <td>
                    {p.name}
                    {p.alive && (p.draft || p.hiddenOffer) && (
                      <span className="tag">{sent && !sent.error ? 'sent a choice' : 'choosing…'}</span>
                    )}
                    {boonSummary(p.slots, p.hiddenBoonId) && (
                      <div className="hint">{boonSummary(p.slots, p.hiddenBoonId)}</div>
                    )}
                    {sent?.error && <div className="warning">Their last choice failed: {sent.error}</div>}
                    <RecoveryPanel
                      player={p}
                      busy={busy}
                      onSpend={(choice) => act((s) => applyChoice(s, p.characterId, choice, Math.random))}
                    />
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
                  <td className="row-actions wrap">
                    {p.alive && (
                      <>
                        {(p.draft || p.hiddenOffer) && (
                          <button type="button" onClick={() => toggle(p.characterId, 'draft')}>
                            {open?.id === p.characterId && open.kind === 'draft' ? 'Hide draft' : 'Draft'}
                          </button>
                        )}
                        <button type="button" onClick={() => toggle(p.characterId, 'boons')}>
                          {open?.id === p.characterId && open.kind === 'boons' ? 'Hide boons' : 'Boons'}
                        </button>
                        {hasClassBoon && (
                          <button
                            type="button"
                            className="quiet"
                            disabled={busy}
                            onClick={() =>
                              act(
                                (s) => classTriggerMet(s, p.characterId),
                                `Mark ${p.name}'s class trigger as met? They get their class hidden boon as an offer.`,
                              )
                            }
                          >
                            Class trigger
                          </button>
                        )}
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
                {p.alive && open?.id === p.characterId && (
                  <tr className="boons-row">
                    <td colSpan={5}>
                      {open.kind === 'boons' ? (
                        <PlayerBoons player={p} character={character} busy={busy} act={act} />
                      ) : (
                        <DraftOffers
                          player={p}
                          who={p.name}
                          passValue={passValue}
                          rerollsLeft={rerollsLeft(p, run.floor)}
                          busy={busy}
                          onChoose={(choice) => act((s) => applyChoice(s, p.characterId, choice, Math.random))}
                        />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
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
