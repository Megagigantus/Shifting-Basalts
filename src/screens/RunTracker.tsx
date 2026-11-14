// DM screen: the run in progress. Every button runs one step from
// rules/runFlow.ts or rules/draftFlow.ts, then saves the new state. While
// open, it also applies players' draft choices sent from their devices.
import { useEffect, useRef, useState } from 'react'
import { Hourglass, Skull, Sparkles } from 'lucide-react'
import type { Character } from '../model/character'
import type { RoomKind, RunPlayer, RunResult, RunState } from '../model/run'
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
import { CounterList, CountersEditor } from './CountersPanel'
import { useLootRequests } from '../runStore'
import { applyChoice } from '../rules/draftChoice'
import { classHiddenBoon } from '../rules/draft'
import { applyChoiceDoc, cancelRun, saveRunState, useChoices, type ChoiceDoc } from '../runStore'
import { boonSummary } from '../rules/boons'
import { PlayerBoons } from './PlayerBoons'
import { DraftOffers } from './DraftOffers'
import { ForgePanel } from './ForgePanel'
import { DmRoom } from './DmRoom'
import { startFloor } from '../rules/roomFlow'
import { forgeUsesLeft, spendForge } from '../rules/forge'
import { artUrl } from '../art'
import { proficiencyBonus } from '../rules/proficiency'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { QUIET_BUTTON } from '../ui/styles'
import { cx, initials, toneClasses } from '../ui/tone'

const ROOM_LABELS = { combat: 'Combat', elite: 'Elite', reprieve: 'Reprieve', boss: 'Boss' }

const SMALL_BUTTON = 'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50'
const ACTION_BUTTON = 'inline-flex items-center gap-1.5 rounded-lg border-0 px-3.5 py-2 text-xs font-bold cursor-pointer disabled:opacity-50'

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
  const roomLabel = run.awaitingChoice ? 'Post-boss' : bossRoom ? 'Boss' : roomKind ? ROOM_LABELS[roomKind] : null

  const blocked = busy || waiting.length > 0
  const roomButton = (label: string, onClick: () => void, tone: 'emerald' | 'sky' | 'indigo' = 'emerald') => (
    <button type="button" disabled={blocked} onClick={onClick} className={cx(ACTION_BUTTON, toneClasses[tone].button)}>
      {label}
    </button>
  )

  // The open panel hides itself once there's nothing to show (e.g. the draft was picked).
  const openPlayer = open
    ? players.find((p) => p.characterId === open.id && p.alive && (open.kind === 'boons' || p.draft || p.hiddenOffer))
    : undefined
  const openCharacter = openPlayer ? characters.find((c) => c.id === openPlayer.characterId) : undefined

  return (
    <div className="space-y-4">
      {/* Run banner: where the party is, the rules in force, and the room buttons. */}
      <Panel hero tone="amber">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone="amber">
                Floor {run.floor} of {LAST_FLOOR}
              </Pill>
              {roomLabel && <Pill tone={bossRoom ? 'rose' : 'stone'}>{roomLabel}</Pill>}
              <Pill tone="stone">Hazard {floor.hazard}</Pill>
              {run.pressures.map((id) => (
                <Pill key={id} tone="rose">
                  {PRESSURES.find((p) => p.id === id)?.name ?? id}
                </Pill>
              ))}
            </div>
            <h2 className="m-0 text-base font-bold text-stone-50">{where}</h2>
            <p className="m-0 text-[11px] text-stone-400">
              Party level {run.partyLevel} · rewards ×{run.entryMultiplier}
              {run.pressureBonusPercent > 0 && ` · Pressures +${run.pressureBonusPercent}%`}
              {(run.extraPressuresBonusPercent ?? 0) > 0 && ` · Extra Pressures +${run.extraPressuresBonusPercent}%`}
              {(run.deepPocketsPercent ?? 0) > 0 && ` · Deep Pockets +${run.deepPocketsPercent}% loot kept`}
              {' · '}
              Loot kept if extracting now:{' '}
              <span className="font-semibold text-stone-200">
                {canExtract(state) ? `${lootKeptIfExtracting(state)}%` : 'opens after a boss'}
              </span>
            </p>
          </div>
          <div
            className="rounded-xl border border-stone-800 bg-stone-950/80 px-3 py-1.5 text-center"
            title="Players find this run automatically when they sign in"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Join code</div>
            <div className="font-mono text-base font-bold tracking-widest text-amber-300">{run.joinCode}</div>
          </div>
        </div>

        {waiting.length > 0 && (
          <p className="m-0 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <Hourglass size={14} /> Waiting on draft picks from {waiting.join(', ')}.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-800 bg-stone-950/70 p-2.5">
          {run.awaitingChoice ? (
            <>
              {run.floor < LAST_FLOOR &&
                roomButton(`Descend to floor ${run.floor + 1}`, () => act((s) => startFloor(descend(s), Math.random)), 'indigo')}
              <button
                type="button"
                disabled={busy || extracting}
                onClick={() => setExtracting(true)}
                className={cx(ACTION_BUTTON, toneClasses.sky.button)}
              >
                {run.floor >= LAST_FLOOR ? 'Finish the full clear…' : `Extract (keep ${lootKeptIfExtracting(state)}%)…`}
              </button>
            </>
          ) : bossRoom ? (
            roomButton('Boss defeated', () => clearAndDraft('boss'))
          ) : roomKind === 'reprieve' ? (
            roomButton('Take the Reprieve', () => clearAndDraft('reprieve'))
          ) : roomKind ? (
            roomButton(roomKind === 'elite' ? 'Elite room cleared' : 'Room cleared', () => clearAndDraft(roomKind))
          ) : (
            <>
              {roomButton('Combat room cleared', () => clearAndDraft('combat'))}
              {roomButton('Elite room cleared', () => clearAndDraft('elite'))}
              {roomButton('Reprieve room', () => clearAndDraft('reprieve'))}
            </>
          )}
          {busy && <span className="text-xs text-stone-400">Saving…</span>}
          <span className="ml-auto">
            <ConfirmButton disabled={busy} confirmLabel="Yes, cancel the run" keepLabel="Keep the run" onConfirm={cancel}>
              Cancel run
            </ConfirmButton>
          </span>
        </div>
        <p className="m-0 text-[11px] text-stone-500">
          Cancelling deletes the run: nobody gets rewards, Devotions or lockouts from it.
        </p>
        {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Main column: the open player panel, then the room and the party's shared things. */}
        <div className="min-w-0 space-y-4 lg:col-span-8">
          {openPlayer && open && (
            <Panel
              tone={open.kind === 'draft' ? 'violet' : 'stone'}
              title={open.kind === 'draft' ? `${openPlayer.name}'s draft` : `${openPlayer.name}'s boons`}
              actions={
                <button type="button" onClick={() => setOpen(null)} className={QUIET_BUTTON}>
                  Close
                </button>
              }
            >
              {open.kind === 'boons' ? (
                <>
                  <PlayerBoons player={openPlayer} character={openCharacter} busy={busy} act={act} />
                  <CountersEditor player={openPlayer} busy={busy} act={act} />
                </>
              ) : (
                <DraftOffers
                  player={openPlayer}
                  who={openPlayer.name}
                  passValue={passValue}
                  rerollsLeft={rerollsLeft(openPlayer, run.floor)}
                  busy={busy}
                  onChoose={(choice) => act((s) => applyChoice(s, openPlayer.characterId, choice, Math.random))}
                />
              )}
            </Panel>
          )}

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

          {run.log.length > 0 && (
            <Panel title={`Rooms cleared (${run.log.length})`}>
              <ol className="m-0 max-h-40 space-y-0.5 overflow-y-auto pl-5 font-mono text-[11px] text-stone-400">
                {run.log.map((entry, i) => (
                  <li key={i}>
                    Floor {entry.floor}, {entry.kind === 'boss' ? 'boss' : `room ${entry.room}`}: {ROOM_LABELS[entry.kind]}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>

        {/* Sidebar: one card per player. */}
        <aside className="min-w-0 space-y-3 lg:col-span-4" aria-label="Party">
          {players.map((p) => (
            <PlayerCard
              key={p.characterId}
              player={p}
              character={characters.find((c) => c.id === p.characterId)}
              sent={choices[p.characterId]}
              open={open?.id === p.characterId ? open.kind : null}
              floor={run.floor}
              busy={busy}
              act={act}
              onToggle={(kind) => toggle(p.characterId, kind)}
            />
          ))}
        </aside>
      </div>
    </div>
  )
}

type Act = (step: (s: RunState) => RunState, confirmText?: string) => Promise<void>

interface CardProps {
  player: RunPlayer
  character: Character | undefined
  sent: ChoiceDoc | undefined
  open: 'boons' | 'draft' | null
  floor: number
  busy: boolean
  act: Act
  onToggle: (kind: 'boons' | 'draft') => void
}

/** A player's card in the sidebar: rewards so far, boons, counters, slot recovery and the DM's buttons. */
function PlayerCard({ player: p, character, sent, open, floor, busy, act, onToggle }: CardProps) {
  const portrait = character?.portrait ? artUrl('portraits', character.portrait) : null
  const hasClassBoon = Boolean(p.draftProfile && classHiddenBoon(p.draftProfile.classId))
  const choosing = p.alive && (p.draft || p.hiddenOffer)
  const summary = boonSummary(p.slots, p.hiddenBoonId)
  const toggleClass = (on: boolean) =>
    cx(SMALL_BUTTON, on ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800')

  return (
    <section
      className={cx(
        'space-y-2.5 rounded-xl border bg-stone-900/90 p-3.5 text-stone-100',
        p.alive ? 'border-stone-800' : 'border-rose-500/30 opacity-75',
      )}
    >
      <header className="flex items-start gap-3">
        {portrait ? (
          <img src={portrait} alt="" className="h-11 w-11 shrink-0 rounded-full border border-stone-700 object-cover" />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-stone-400">
            {initials(p.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 truncate text-sm font-bold">{p.name}</h3>
            {!p.alive ? (
              <Pill tone="rose" icon={<Skull size={11} />}>
                Fallen
              </Pill>
            ) : (
              choosing && <Pill tone={sent && !sent.error ? 'emerald' : 'violet'}>{sent && !sent.error ? 'Sent a choice' : 'Choosing…'}</Pill>
            )}
          </div>
          {character && (
            <div className="text-[11px] text-stone-400">
              Lv {character.level} · PB +{proficiencyBonus(character.level)}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Pill tone="purple" mono title="Boss Quantum Basalts, before Pressure bonuses. Lost on death.">
          {p.alive ? `Run QB ${p.quantumBasaltsEarned}` : `Run QB ${p.quantumBasaltsEarned} (forfeit)`}
        </Pill>
        <Pill tone="emerald" mono title="Quantum Basalts from passing. Kept even on death.">
          Safe QB {p.quantumBasaltsPassed}
        </Pill>
        <Pill tone="indigo" mono title="Devotions earned this run">
          {p.devotions} Devotions
        </Pill>
      </div>

      {summary && <p className="m-0 text-[11px] text-stone-300">{summary}</p>}
      {sent?.error && <p className="m-0 text-[11px] text-amber-300">Their last choice failed: {sent.error}</p>}
      <CounterList player={p} />
      <RecoveryPanel player={p} busy={busy} onSpend={(choice) => act((s) => applyChoice(s, p.characterId, choice, Math.random))} />

      {!p.alive && (
        <p className="m-0 text-[11px] text-rose-300">
          Fell on floor {p.diedOnFloor} · locked out {p.lockoutDays} days (rolled {p.lockoutRolls?.join(' + ')}
          {(p.quickReturnDays ?? 0) > 0 && `, Quick Return −${p.quickReturnDays}, minimum 1`})
        </p>
      )}

      {p.alive && (
        <div className="flex flex-wrap gap-1.5 border-t border-stone-800 pt-2.5">
          {(p.draft || p.hiddenOffer) && (
            <button type="button" aria-pressed={open === 'draft'} onClick={() => onToggle('draft')} className={toggleClass(open === 'draft')}>
              <Sparkles size={12} /> Draft
            </button>
          )}
          <button type="button" aria-pressed={open === 'boons'} onClick={() => onToggle('boons')} className={toggleClass(open === 'boons')}>
            Boons
          </button>
          {hasClassBoon && (
            <ConfirmButton
              tone="violet"
              disabled={busy}
              confirmLabel="Yes, trigger met"
              onConfirm={() => act((s) => classTriggerMet(s, p.characterId))}
            >
              Class trigger
            </ConfirmButton>
          )}
          <span className="ml-auto">
            <ConfirmButton
              disabled={busy}
              confirmLabel={`Yes, ${p.name} died`}
              onConfirm={() => act((s) => markDead(s, p.characterId))}
            >
              <Skull size={12} /> Died
            </ConfirmButton>
          </span>
        </div>
      )}
      {p.alive && (
        <p className="m-0 text-[10px] text-stone-500">
          Died: expelled, loses this run's boss Basalts, locked out {floor}d4 days.
          {hasClassBoon && ' Class trigger: offers their class hidden boon.'}
        </p>
      )}
    </section>
  )
}
