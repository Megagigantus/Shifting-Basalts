// Recovery point pools for one player: points left per recovery track this
// room, buttons to spend on presets or held payoff boons, and Level 3 refunds.
// Used on the DM's party table and on the player's own screen.
import type { RunPlayer } from '../model/run'
import type { DraftChoice } from '../rules/draftChoice'
import {
  heldPayoffs,
  pointsLabel,
  pointsLeft,
  RECOVERY_TRACKS,
  recoveryPresets,
  trackRank,
} from '../rules/recovery'
import { Sparkles } from 'lucide-react'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

interface Props {
  player: RunPlayer
  busy: boolean
  onSpend: (choice: Extract<DraftChoice, { action: 'recover' | 'payoffSpend' | 'payoffRefund' }>) => void
}

export function RecoveryPanel({ player, busy, onSpend }: Props) {
  const tracks = RECOVERY_TRACKS.filter((track) => trackRank(player, track) > 0)
  if (!player.alive || tracks.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {tracks.map((track) => {
        const rank = trackRank(player, track)
        const points = pointsLeft(player, track)
        const payoffs = heldPayoffs(player, track)
        const martial = track === 'martial-resource-recovery'
        return (
          <div
            key={track}
            className={cx(
              'flex flex-col gap-1.5 rounded-lg border p-2.5',
              martial ? 'border-amber-500/25 bg-amber-500/5' : 'border-sky-500/25 bg-sky-500/5',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-200">
              <Sparkles size={13} className={martial ? 'text-amber-300' : 'text-sky-300'} />
              <span className="mr-auto">{pointsLabel(track)}</span>
              <span className={cx('font-mono font-bold', martial ? 'text-amber-200' : 'text-sky-200')}>
                {points} / {rank}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recoveryPresets(track).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cx(
                    SMALL_BUTTON,
                    points >= preset.cost && (martial ? 'border-amber-500/40 text-amber-200' : 'border-sky-500/40 text-sky-200'),
                  )}
                  disabled={busy || points < preset.cost}
                  onClick={() => onSpend({ action: 'recover', track, presetId: preset.id })}
                >
                  {preset.label} ({preset.cost})
                </button>
              ))}
              {payoffs.map((payoff) => (
                <span key={payoff.boonId} className="contents">
                  <button
                    type="button"
                    className={cx(SMALL_BUTTON, 'text-amber-200')}
                    disabled={busy || points < 1}
                    onClick={() => onSpend({ action: 'payoffSpend', boonId: payoff.boonId })}
                  >
                    {payoff.name}: Spend 1
                  </button>
                  {payoff.level >= 3 && (
                    <button
                      type="button"
                      className={cx(SMALL_BUTTON, 'text-emerald-200')}
                      disabled={busy}
                      onClick={() => onSpend({ action: 'payoffRefund', boonId: payoff.boonId })}
                    >
                      {payoff.name}: +1 refund
                    </button>
                  )}
                </span>
              ))}
            </div>
            {points > 0 && <span className="text-[0.6875rem] text-stone-500">Unspent points fade at the next room clear.</span>}
          </div>
        )
      })}
    </div>
  )
}
