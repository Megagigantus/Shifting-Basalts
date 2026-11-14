// A small rounded label, e.g. "PB +3", "Lv 2", "CR 5" or "+15%".
import type { ReactNode } from 'react'
import { cx, toneClasses, type Tone } from './tone'

interface Props {
  tone?: Tone
  /** Optional icon (a lucide icon element) before the text. */
  icon?: ReactNode
  /** Use the monospace font, for numbers. */
  mono?: boolean
  title?: string
  className?: string
  children: ReactNode
}

export function Pill({ tone = 'stone', icon, mono, title, className, children }: Props) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap',
        mono && 'font-mono',
        toneClasses[tone].pill,
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}
