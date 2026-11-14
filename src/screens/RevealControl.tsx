// DM only: whether players can see something yet, with a button to show it.
import { Eye, EyeOff } from 'lucide-react'
import { Pill } from '../ui/Pill'
import { SMALL_BUTTON } from '../ui/styles'

interface Props {
  shown: boolean
  busy: boolean
  onReveal: () => void
  /** Button text (default "Reveal"). */
  label?: string
  /** Pill text once shown (default "Shown"). */
  shownLabel?: string
}

export function RevealControl({ shown, busy, onReveal, label = 'Reveal', shownLabel = 'Shown' }: Props) {
  if (shown) {
    return (
      <Pill tone="emerald" icon={<Eye size={11} />} title="Players can see this">
        {shownLabel}
      </Pill>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Pill tone="rose" icon={<EyeOff size={11} />} title="Players can't see this yet">
        Hidden
      </Pill>
      <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={onReveal}>
        {label}
      </button>
    </span>
  )
}
