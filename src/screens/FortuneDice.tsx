// Fortune Dice badge for one player: dice left this run out of their per-run
// allowance, with a Use button for players/DM and − / + corrections for the DM.
import { Dices } from 'lucide-react'
import type { RunPlayer } from '../model/run'
import { fortuneDiceLeft, fortuneDicePerRun } from '../rules/fortune'
import { Pill } from '../ui/Pill'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

interface Props {
  player: RunPlayer
  busy: boolean
  onUse?: () => void
  onSet?: (dice: number) => void
}

/** Fortune Dice pool pill, with optional Use and DM correction controls. */
export function FortuneDiceBadge({ player, busy, onUse, onSet }: Props) {
  const perRun = fortuneDicePerRun(player.draftProfile?.trackDevotions ?? {})
  const left = fortuneDiceLeft(player)
  if (perRun === 0 && left === 0) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Pill
        tone="amber"
        mono
        icon={<Dices size={11} />}
        title="Fortune Dice left this run. Use one for a reroll, or when a Gleam Dealer's Gamble stake fails."
      >
        Fortune Dice {left} / {perRun}
      </Pill>
      {onUse && (
        <button
          type="button"
          className={cx(SMALL_BUTTON, left > 0 && player.alive && 'border-amber-500/40 text-amber-200')}
          aria-label={`Use a Fortune Die for ${player.name}`}
          disabled={busy || left <= 0 || !player.alive}
          onClick={onUse}
        >
          Use a die
        </button>
      )}
      {onSet && (
        <>
          <button
            type="button"
            className={SMALL_BUTTON}
            aria-label={`Lower Fortune Dice for ${player.name}`}
            disabled={busy || left <= 0}
            onClick={() => onSet(left - 1)}
          >
            −
          </button>
          <button
            type="button"
            className={SMALL_BUTTON}
            aria-label={`Raise Fortune Dice for ${player.name}`}
            disabled={busy}
            onClick={() => onSet(left + 1)}
          >
            +
          </button>
        </>
      )}
    </span>
  )
}
