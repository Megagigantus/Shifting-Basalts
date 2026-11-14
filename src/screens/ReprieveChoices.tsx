// Reprieve choices for one or more players: Rest, Reflect (pick a boon to
// level), or catch-up Basalts when no boon can level. The DM's room shows
// every living player (the DM can choose for anyone); a player's room shows
// only their own characters. The screen only reports the choice through
// onChoose; the caller applies it (DM) or sends it (player).
import { useState } from 'react'
import { BedDouble, Coins, Sparkles } from 'lucide-react'
import type { RunPlayer, RunState } from '../model/run'
import type { DraftChoice } from '../rules/draftChoice'
import { slotName } from '../rules/boons'
import { canTakeCatchUp, catchUpBasalts, currentReprieveChoice, describeReprieve, reflectableSlots } from '../rules/reprieve'
import { Pill } from '../ui/Pill'
import { FIELD, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

type ReprieveAction = Extract<DraftChoice, { action: 'reprieveRest' | 'reprieveReflect' | 'reprieveBasalts' }>

interface Props {
  state: RunState
  players: RunPlayer[]
  busy: boolean
  /** Players whose choice was sent and is waiting to be applied. */
  pending?: Set<string>
  onChoose: (characterId: string, choice: ReprieveAction) => void
}

export function ReprieveChoices({ state, players, busy, pending, onChoose }: Props) {
  const living = players.filter((p) => p.alive)
  if (living.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {living.map((p) => (
        <PlayerChoice key={p.characterId} state={state} player={p} busy={busy || Boolean(pending?.has(p.characterId))} sent={Boolean(pending?.has(p.characterId))} onChoose={onChoose} />
      ))}
    </div>
  )
}

function PlayerChoice({
  state,
  player,
  busy,
  sent,
  onChoose,
}: {
  state: RunState
  player: RunPlayer
  busy: boolean
  sent: boolean
  onChoose: Props['onChoose']
}) {
  const reflectable = reflectableSlots(player.slots)
  const [slot, setSlot] = useState<number>(reflectable[0] ?? -1)
  const chosen = currentReprieveChoice(state, player)
  const catchUp = canTakeCatchUp(player)
  const id = player.characterId

  return (
    <div className={cx('flex flex-col gap-2 rounded-lg border p-2.5', chosen ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-stone-800 bg-stone-950/70')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <strong className="mr-auto text-xs text-stone-100">{player.name}</strong>
        {chosen ? <Pill tone="emerald">{describeReprieve(chosen)}</Pill> : sent ? <Pill tone="amber">Sent, waiting…</Pill> : <Pill tone="violet">Choosing…</Pill>}
      </div>
      {!chosen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={cx(SMALL_BUTTON, 'text-emerald-200')} disabled={busy} onClick={() => onChoose(id, { action: 'reprieveRest' })}>
            <BedDouble size={12} /> Rest
          </button>
          {reflectable.length > 0 && (
            <>
              <select
                value={slot}
                onChange={(e) => setSlot(Number(e.target.value))}
                disabled={busy}
                aria-label={`Boon for ${player.name} to level up`}
                className={cx(FIELD, 'py-1 text-xs')}
              >
                {reflectable.map((i) => {
                  const s = player.slots![i]!
                  return (
                    <option key={i} value={i}>
                      {slotName(s)} → Level {s.kind === 'boon' ? s.level + 1 : ''}
                    </option>
                  )
                })}
              </select>
              <button
                type="button"
                className={cx(SMALL_BUTTON, 'text-violet-200')}
                disabled={busy || !reflectable.includes(slot)}
                onClick={() => onChoose(id, { action: 'reprieveReflect', slotIndex: slot })}
              >
                <Sparkles size={12} /> Reflect
              </button>
            </>
          )}
          {catchUp && (
            <button type="button" className={cx(SMALL_BUTTON, 'text-purple-200')} disabled={busy} onClick={() => onChoose(id, { action: 'reprieveBasalts' })}>
              <Coins size={12} /> Catch-up Basalts (+{catchUpBasalts(state)})
            </button>
          )}
        </div>
      )}
      {!chosen && catchUp && (
        <span className="text-[0.625rem] text-stone-500">No boon can level up, so Reflect gives catch-up Basalts instead (kept even on death).</span>
      )}
    </div>
  )
}
