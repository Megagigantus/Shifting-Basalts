// Shrine to Thils (rules/loot.ts): in any room with this terrain, a living
// player or the DM can offer one trinket from the party's loot to reroll one
// loot roll from this floor into a new item of the same kind.
import { useState, type ReactNode } from 'react'
import { Flame, Hourglass } from 'lucide-react'
import type { RunPlayer, RunState } from '../model/run'
import {
  itemName,
  itemText,
  rerollableItems,
  shrineBlocker,
  shrineHereThils,
  shrineOffering,
  shrineUsedHere,
} from '../rules/loot'
import type { ChoiceDoc } from '../runStore'
import { Pill } from '../ui/Pill'
import { FIELD, LINK_BUTTON, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'
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
  if (props.mode === 'dm') {
    return (
      <ShrineContent
        state={props.state}
        disabled={props.busy}
        onOffer={(trinketUid, targetUid) => props.act((s) => shrineOffering(s, trinketUid, targetUid, Math.random))}
      />
    )
  }
  return <PlayerThilsShrine {...props} />
}

function PlayerThilsShrine({
  state,
  player,
  sent,
  readOnly = false,
  dmChoosing = false,
}: Extract<ThilsShrinePanelProps, { mode: 'player' }>) {
  const { choose, cancel, sending, waiting, error, locked } = useChoiceSender(state, player, sent, readOnly, dmChoosing)

  return (
    <ShrineContent
      state={state}
      disabled={locked || sending || waiting}
      onOffer={(trinketUid, targetUid) => {
        void choose({ action: 'shrineOffering', trinketUid, targetUid })
      }}
    >
      {waiting && (
        <p className="m-0 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Hourglass size={14} />
          <span className="mr-auto">Offering sent. Waiting for your DM's app to apply it…</span>
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

function ShrineContent({
  state,
  disabled,
  onOffer,
  children,
}: {
  state: RunState
  disabled: boolean
  onOffer: (trinketUid: string, targetUid: string) => void
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
      {children}
    </div>
  )
}
