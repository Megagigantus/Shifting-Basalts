// The Closing Ring Pressure on the room card. Everyone sees how deep the ring
// is, when it next grows and what it does. The DM also gets the controls:
// Next round (the ring grows on its schedule), and Advance, Pull back and
// Reset for corrections. Nothing here is hidden, so players see the same text.
import { CircleDashed } from 'lucide-react'
import { ringHazardText, ringSettings, ringSummary, squaresAcross, type RingState } from '../rules/closingRing'
import { ConfirmButton } from '../ui/ConfirmButton'
import { PRIMARY_BUTTON, SMALL_BUTTON } from '../ui/styles'

interface Props {
  ring: RingState | null
  pressures: string[]
  floor: number
  partyLevel: number
  room: { size: string; map?: { squares: number } | null }
  /** DM only: the controls. */
  controls?: {
    busy: boolean
    onNextRound: () => void
    onAdvance: () => void
    onPullBack: () => void
    onReset: () => void
  }
}

export function ClosingRingNote({ ring, pressures, floor, partyLevel, room, controls }: Props) {
  const settings = ringSettings(pressures)
  if (!ring || !settings) return null
  const squares = squaresAcross(room)
  const name = pressures.includes('closing-ring-2') ? 'Closing Ring II' : 'Closing Ring'
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
      <p className="m-0 flex items-start gap-1.5">
        <CircleDashed size={14} className="mt-0.5 shrink-0 text-rose-300" aria-hidden="true" />
        <span>
          <strong>{name}.</strong> {ringSummary(ring, settings, squares)} {ringHazardText(settings, floor, partyLevel)}
        </span>
      </p>
      {controls && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={PRIMARY_BUTTON} disabled={controls.busy} onClick={controls.onNextRound}>
            Next round (to {ring.round + 1})
          </button>
          <button type="button" className={SMALL_BUTTON} disabled={controls.busy} onClick={controls.onAdvance}>
            Advance ring
          </button>
          <button type="button" className={SMALL_BUTTON} disabled={controls.busy || ring.width === 0} onClick={controls.onPullBack}>
            Pull back
          </button>
          <ConfirmButton tone="amber" disabled={controls.busy} confirmLabel="Yes, back to round 1" onConfirm={controls.onReset}>
            Reset
          </ConfirmButton>
        </div>
      )}
    </div>
  )
}
