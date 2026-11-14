// A card for one section of a screen: optional title row with an icon and
// buttons on the right, then the content.
import type { ReactNode } from 'react'
import { cx, toneClasses, type Tone } from './tone'

interface Props {
  title?: ReactNode
  /** Small line under the title. */
  subtitle?: ReactNode
  /** Optional icon (a lucide icon element) before the title. */
  icon?: ReactNode
  /** Buttons or pills on the right of the title row. */
  actions?: ReactNode
  /** Accent border color; stone (neutral) by default. */
  tone?: Tone
  /** Larger corners and a shadow, for the main card on a screen. */
  hero?: boolean
  className?: string
  children?: ReactNode
}

export function Panel({ title, subtitle, icon, actions, tone = 'stone', hero, className, children }: Props) {
  const hasHeader = title || subtitle || actions
  return (
    <section
      className={cx(
        'border bg-stone-900/90 p-4 flex flex-col gap-3 text-stone-100',
        hero ? 'rounded-2xl shadow-2xl shadow-black/40' : 'rounded-xl',
        toneClasses[tone].border,
        className,
      )}
    >
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && (
              <h2 className={cx('m-0 flex items-center gap-2 text-sm font-bold', tone !== 'stone' && toneClasses[tone].text)}>
                {icon}
                {title}
              </h2>
            )}
            {subtitle && <p className="m-0 mt-0.5 text-xs text-stone-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

/** Small uppercase label for a group inside a panel, e.g. "BOON COUNTERS". */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cx('m-0 text-[10px] font-bold uppercase tracking-wider text-stone-400', className)}>{children}</h3>
  )
}
