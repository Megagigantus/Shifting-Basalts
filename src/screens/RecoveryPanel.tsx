// Spell slot recovery for one player: points left this room, buttons to
// recover slots (and Leyline Surge), and what they've bought. Used on the DM's
// party table and on the player's own screen.
import type { RunPlayer } from '../model/run'
import type { DraftChoice } from '../rules/draftChoice'
import { holdsLeylineSurge, recoverableLevels, recoveryCost, recoveryRank } from '../rules/recovery'

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
    <div className="recovery">
      <span className="hint">
        Slot recovery: <strong>{r.points}</strong> of {rank} points this room
        {r.bought.length > 0 && ` · recovered ${r.bought.map(ordinal).join(', ')}`}
        {r.surged > 0 && ` · ${r.surged} on Leyline Surge`}
      </span>{' '}
      <span className="row-actions wrap">
        {recoverableLevels(player).map((level) => {
          const cost = recoveryCost(level)!
          return (
            <button
              key={level}
              type="button"
              className="quiet"
              disabled={busy || r.points < cost}
              onClick={() => onSpend({ action: 'recover', slotLevel: level })}
            >
              {ordinal(level)} ({cost})
            </button>
          )
        })}
        {holdsLeylineSurge(player) && (
          <button type="button" className="quiet" disabled={busy || r.points < 1} onClick={() => onSpend({ action: 'surge' })}>
            Leyline Surge (1)
          </button>
        )}
      </span>
      {r.points > 0 && <div className="hint">Unspent points fade at the next room clear.</div>}
    </div>
  )
}
