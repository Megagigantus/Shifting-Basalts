// Shrine to Thils (rules/loot.ts): in any room with this terrain, a living
// player or the DM can offer one trinket from the party's loot to reroll one
// loot roll from this floor into a new item of the same kind, or wake a
// Dormant relic with banked Quantum Basalts (rules/vault.ts).
import { useState, type ReactNode } from 'react'
import { Flame, Hourglass } from 'lucide-react'
import type { Character } from '../model/character'
import type { RunPlayer, RunState } from '../model/run'
import {
  itemName,
  itemText,
  relicOf,
  rerollableItems,
  shrineBlocker,
  shrineHereThils,
  shrineOffering,
  shrineUsedHere,
} from '../rules/loot'
import { dormantRelics, WAKE_COST, wakeBlocker, wakeLine } from '../rules/vault'
import { wakeRelicAtShrine, type ChoiceDoc } from '../runStore'
import { SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { FIELD, LINK_BUTTON, SMALL_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'
import { useCharacters } from '../useCharacters'
import { useChoiceSender } from './useChoiceSender'

export type Act = (step: (s: RunState) => RunState, confirmText?: string) => void

export type ThilsShrinePanelProps =
  | {
      mode: 'dm'
      state: RunState
      act: Act
      busy: boolean
    }
  | {
      mode: 'player'
      state: RunState
      player: RunPlayer
      sent: ChoiceDoc | undefined
      readOnly?: boolean
      dmChoosing?: boolean
    }

const USED_BLOCKER = 'This shrine has already taken an offering.'

export function ThilsShrinePanel(props: ThilsShrinePanelProps) {
  if (!shrineHereThils(props.state)) return null
  if (props.mode === 'dm') return <DmThilsShrine {...props} />
  return <PlayerThilsShrine {...props} />
}

function DmThilsShrine({ state, act, busy }: Extract<ThilsShrinePanelProps, { mode: 'dm' }>) {
  const { characters } = useCharacters()
  const [waking, setWaking] = useState(false)
  const [wakeError, setWakeError] = useState<string | null>(null)

  const relevant = state.players
    .filter((p) => p.alive)
    .flatMap((p) => {
      const c = characters?.find((ch) => ch.id === p.characterId)
      return c ? [c] : []
    })

  async function handleWake(relicId: string, characterId: string) {
    setWakeError(null)
    setWaking(true)
    try {
      await wakeRelicAtShrine(state, characterId, relicId)
    } catch (err) {
      setWakeError(err instanceof Error ? err.message : String(err))
    } finally {
      setWaking(false)
    }
  }

  return (
    <ShrineContent
      state={state}
      disabled={busy}
      onOffer={(trinketUid, targetUid) => act((s) => shrineOffering(s, trinketUid, targetUid, Math.random))}
      wake={{
        characters: relevant,
        showOwner: true,
        disabled: busy || waking,
        error: wakeError,
        onWake: (relicId, characterId) => {
          void handleWake(relicId, characterId)
        },
      }}
    />
  )
}

function PlayerThilsShrine({
  state,
  player,
  sent,
  readOnly = false,
  dmChoosing = false,
}: Extract<ThilsShrinePanelProps, { mode: 'player' }>) {
  const { choose, cancel, sending, waiting, error, locked } = useChoiceSender(state, player, sent, readOnly, dmChoosing)
  const { characters } = useCharacters()
  const character = characters?.find((c) => c.id === player.characterId)
  const disabled = locked || sending || waiting
  // The DM picking in a player's preview wakes the relic straight away
  // (applyChoice can't, since waking changes the character, not the run).
  const [wakeError, setWakeError] = useState<string | null>(null)
  async function wakeAsDm(relicId: string) {
    setWakeError(null)
    try {
      await wakeRelicAtShrine(state, player.characterId, relicId)
    } catch (err) {
      setWakeError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <ShrineContent
      state={state}
      disabled={disabled}
      onOffer={(trinketUid, targetUid) => {
        void choose({ action: 'shrineOffering', trinketUid, targetUid })
      }}
      wake={{
        characters: character ? [character] : [],
        showOwner: false,
        disabled,
        error: wakeError,
        onWake: (relicId) => {
          void (dmChoosing ? wakeAsDm(relicId) : choose({ action: 'wakeRelic', relicId }))
        },
      }}
    >
      {waiting && (
        <p className="m-0 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Hourglass size={14} />
          <span className="mr-auto">Sent to the shrine. Waiting for your DM's app to apply it…</span>
          {!locked && (
            <button type="button" className={LINK_BUTTON} disabled={sending} onClick={() => void cancel()}>
              Change my mind
            </button>
          )}
        </p>
      )}
      {sent?.error && <p className="m-0 text-xs text-rose-300">Your last choice didn't go through: {sent.error}</p>}
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </ShrineContent>
  )
}

interface WakeSectionProps {
  characters: Character[]
  showOwner: boolean
  disabled: boolean
  error?: string | null
  onWake: (relicId: string, characterId: string) => void
}

function ShrineContent({
  state,
  disabled,
  onOffer,
  wake,
  children,
}: {
  state: RunState
  disabled: boolean
  onOffer: (trinketUid: string, targetUid: string) => void
  wake: WakeSectionProps
  children?: ReactNode
}) {
  const [offer, setOffer] = useState('')
  const [target, setTarget] = useState('')
  const used = shrineUsedHere(state)
  const blocker = shrineBlocker(state)
  const items = state.run.loot?.items ?? []
  const trinkets = items.filter((i) => i.kind === 'trinket')
  const targets = rerollableItems(state)

  const validOffer = trinkets.some((t) => t.uid === offer) ? offer : ''
  const validTarget = targets.some((t) => t.uid === target && t.uid !== validOffer) ? target : ''

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Flame size={14} className="text-amber-300" />
        <strong className="mr-auto text-sm text-amber-100">Shrine to Thils</strong>
        <Pill tone={used ? 'emerald' : 'amber'}>{used ? 'Offering made' : '1 offering'}</Pill>
      </div>
      <p className="m-0 text-[0.6875rem] text-stone-300">
        Leave a trinket from the party's loot as an offering: one loot roll from this floor is rerolled into a new item of the same kind. One offering per shrine.
      </p>
      {blocker !== null ? (
        <p className={cx('m-0 text-xs', blocker === USED_BLOCKER ? 'text-emerald-300' : 'text-stone-400')}>{blocker}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
          <label className="inline-flex items-center gap-1.5">
            <span>Offer</span>
            <select
              value={validOffer}
              disabled={disabled}
              onChange={(e) => {
                const next = e.target.value
                setOffer(next)
                if (target === next) setTarget('')
              }}
              className={cx(FIELD, 'py-1 text-xs')}
            >
              <option value="">a trinket…</option>
              {trinkets.map((t) => (
                <option key={t.uid} value={t.uid}>
                  {itemText(t).slice(0, 40)}…
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span>Reroll</span>
            <select
              value={validTarget}
              disabled={disabled}
              onChange={(e) => setTarget(e.target.value)}
              className={cx(FIELD, 'py-1 text-xs')}
            >
              <option value="">a loot roll from this floor…</option>
              {targets
                .filter((t) => t.uid !== validOffer)
                .map((t) => (
                  <option key={t.uid} value={t.uid}>
                    {t.kind === 'trinket' ? `Trinket: ${itemText(t).slice(0, 40)}…` : itemName(t)}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            disabled={disabled || !validOffer || !validTarget}
            onClick={() => {
              onOffer(validOffer, validTarget)
              setOffer('')
              setTarget('')
            }}
            className={cx(SMALL_BUTTON, 'border-amber-500/40 bg-amber-500/20 text-amber-200')}
          >
            Make the offering
          </button>
        </div>
      )}
      <WakeRelicSection active={state.run.status === 'active'} {...wake} />
      {children}
    </div>
  )
}

function WakeRelicSection({ active, characters, showOwner, disabled, error, onWake }: WakeSectionProps & { active: boolean }) {
  if (!active) return null
  const rows = characters.flatMap((character) => dormantRelics(character).map((item) => ({ character, item })))
  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-2 border-t border-amber-500/20 pt-2.5">
      <SectionLabel>Wake a relic</SectionLabel>
      <p className="m-0 text-[0.6875rem] text-stone-300">{wakeLine()}</p>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ character, item }) => {
          const blocker = wakeBlocker(character, item.ref)
          return (
            <div key={`${character.id}-${item.uid}`} className={cx(WELL, 'flex flex-wrap items-center justify-between gap-2 py-2')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-fuchsia-300">{relicOf(item.ref).name}</span>
                {showOwner && <span className="text-xs text-stone-200">{character.name}</span>}
                <Pill tone="purple" mono>
                  {character.bankedQuantumBasalts} Quantum Basalts banked
                </Pill>
              </div>
              {blocker !== null ? (
                <span className="text-xs text-stone-400">{blocker}</span>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onWake(item.ref, character.id)}
                  className={cx(SMALL_BUTTON, 'border-amber-500/40 bg-amber-500/20 text-amber-200')}
                >
                  Wake ({WAKE_COST} Quantum Basalts)
                </button>
              )}
            </div>
          )
        })}
      </div>
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  )
}
