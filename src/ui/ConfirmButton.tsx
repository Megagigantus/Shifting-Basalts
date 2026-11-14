// A button that asks "are you sure?" in place: the first click swaps it for
// a Confirm button and a Keep button. Used for actions that can't be undone
// (cancel run, party wipe, delete). It resets by itself after a few seconds.
import { useEffect, useState, type ReactNode } from 'react'
import { cx, toneClasses, type Tone } from './tone'

interface Props {
  /** What the button says before it's clicked, e.g. "Cancel run". */
  children: ReactNode
  /** What the confirm button says, e.g. "Yes, cancel the run". */
  confirmLabel: ReactNode
  /** What the back-out button says. */
  keepLabel?: ReactNode
  onConfirm: () => void
  tone?: Tone
  disabled?: boolean
  className?: string
}

const BUTTON = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50'

export function ConfirmButton({ children, confirmLabel, keepLabel = 'Keep', onConfirm, tone = 'rose', disabled, className }: Props) {
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (!asking) return
    const timer = setTimeout(() => setAsking(false), 6000)
    return () => clearTimeout(timer)
  }, [asking])

  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className={cx(BUTTON, toneClasses.stone.button, className)}>
        {children}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5" role="group">
      <button
        type="button"
        autoFocus
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
        className={cx(BUTTON, 'border-0', toneClasses[tone].button)}
      >
        {confirmLabel}
      </button>
      <button type="button" onClick={() => setAsking(false)} className={cx(BUTTON, toneClasses.stone.button)}>
        {keepLabel}
      </button>
    </span>
  )
}
