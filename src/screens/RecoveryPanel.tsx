// Spell slot recovery for one player: points left this room, buttons to
// recover slots (and Leyline Surge), and what they've bought. Used on the DM's
// party table and on the player's own screen.
import type { RunPlayer } from '../model/run'
import type { DraftChoice } from '../rules/draftChoice'
import { holdsLeylineSurge, recoverableLevels, recoveryCost, recoveryRank } from '../rules/recovery'
import { Sparkles } from 'lucide-react'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

const ordinal = (n: number) => ['', '1st', '2nd', '3rd', '4th', '5th'][n] ?? `${n}th`

interface Props {
  player: RunPlayer
  busy: boolean
  onSpend: (choice: Extract<DraftChoice, { action: 'recover' | 'surge' }>) => void
}

export function RecoveryPanel({ player, busy, onSpend }: Props) {
  const rank = recoveryRank(player)
  if (!player.alive || rank === 0) return null
  const r = player.recovery ?? { points: 0, bought: [], surged: 0 }
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/5 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-200">
        <Sparkles size={13} className="text-sky-300" />
        <span className="mr-auto">Slot recovery points</span>
        <span className="font-mono font-bold text-sky-200">
          {r.points} / {rank}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recoverableLevels(player).map((level) => {
          const cost = recoveryCost(level)!
          return (
            <button
              key={level}
              type="button"
              className={cx(SMALL_BUTTON, r.points >= cost && 'border-sky-500/40 text-sky-200')}
              disabled={busy || r.points < cost}
              onClick={() => onSpend({ action: 'recover', slotLevel: level })}
            >
              {ordinal(level)} ({cost})
            </button>
          )
        })}
        {holdsLeylineSurge(player) && (
          <button type="button" className={cx(SMALL_BUTTON, 'text-amber-200')} disabled={busy || r.points < 1} onClick={() => onSpend({ action: 'surge' })}>
            Leyline Surge (1)
          </button>
        )}
      </div>
      {(r.bought.length > 0 || r.surged > 0) && (
        <span className="text-[0.6875rem] text-stone-400">
          {r.bought.length > 0 && `Recovered ${r.bought.map(ordinal).join(', ')}`}
          {r.bought.length > 0 && r.surged > 0 && ' · '}
          {r.surged > 0 && `${r.surged} on Leyline Surge`}
        </span>
      )}
      {r.points > 0 && <span className="text-[0.6875rem] text-stone-500">Unspent points fade at the next room clear.</span>}
    </div>
  )
}
