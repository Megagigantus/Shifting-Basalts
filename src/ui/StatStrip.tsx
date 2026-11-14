// A row of small labelled numbers, e.g. Party level · Forge & Font · Reward bonus.
import type { ReactNode } from 'react'
import { cx, toneClasses, type Tone } from './tone'

export interface Stat {
  label: string
  value: ReactNode
  /** Small grey line under the value. */
  hint?: ReactNode
  /** Color for the value; neutral by default. */
  tone?: Tone
}

export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cx(
        'm-0 grid grid-cols-2 gap-3 rounded-xl border border-stone-800 bg-stone-950/80 p-3 sm:grid-cols-3 lg:grid-cols-5',
        className,
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">{s.label}</dt>
          <dd className={cx('m-0 mt-0.5 text-sm font-bold', toneClasses[s.tone ?? 'stone'].text)}>{s.value}</dd>
          {s.hint && <dd className="m-0 text-[11px] text-stone-500">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
