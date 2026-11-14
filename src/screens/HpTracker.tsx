// DM tools for the fight: an HP row per tracked creature or boss part, and a
// compact ability/save line. Players never see any of this.
import { useState } from 'react'
import type { Tracker } from '../rules/hp'
import { ABILITIES, type Ability } from '../rules/encounters'
import { Pill } from '../ui/Pill'
import { FIELD, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
const mod = (score: number) => Math.floor((score - 10) / 2)

/** AC, HP and the six abilities with their saves, as small chips. */
export function StatLine({
  ac,
  hp,
  abilities,
  saves,
}: {
  ac?: number
  hp?: number
  abilities: Record<Ability, number>
  saves: Record<Ability, number>
}) {
  const chip = 'rounded-md border border-stone-800 bg-stone-950/80 px-1.5 py-0.5 font-mono text-[10px] text-stone-300'
  return (
    <div className="flex flex-wrap gap-1">
      {ac !== undefined && <span className={cx(chip, 'text-sky-200')}>AC {ac}</span>}
      {hp !== undefined && <span className={cx(chip, 'text-rose-200')}>HP {hp}</span>}
      {ABILITIES.map((a) => (
        <span key={a} className={chip} title={`${a.toUpperCase()} ${abilities[a]} (${signed(mod(abilities[a]))}), save ${signed(saves[a])}`}>
          <span className="font-bold text-stone-400">{a.toUpperCase()}</span> {abilities[a]} ({signed(mod(abilities[a]))}) · sv{' '}
          {signed(saves[a])}
        </span>
      ))}
    </div>
  )
}

/** One HP row: current / max, a bar, Bloodied or Down, and damage/heal buttons. */
function HpRow({ t, busy, onChange }: { t: Tracker; busy: boolean; onChange: (amount: number) => void }) {
  const [value, setValue] = useState('')
  const amount = Number(value)
  const ok = value.trim() !== '' && Number.isFinite(amount) && amount > 0
  const apply = (sign: 1 | -1) => {
    if (!ok) return
    onChange(sign * Math.round(amount))
    setValue('')
  }
  const pct = t.max > 0 ? (t.current / t.max) * 100 : 0
  return (
    <li
      className={cx(
        'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-2 py-1.5',
        t.down ? 'border-stone-800 bg-stone-950/40 opacity-60' : t.bloodied ? 'border-rose-500/30 bg-rose-950/20' : 'border-stone-800 bg-stone-950/60',
      )}
    >
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-200">{t.label}</span>
      <span className={cx('font-mono text-xs font-bold', t.down ? 'text-stone-500' : t.bloodied ? 'text-rose-300' : 'text-emerald-300')}>
        {t.current} / {t.max}
      </span>
      {t.down ? <Pill>Down</Pill> : t.bloodied && <Pill tone="rose">Bloodied</Pill>}
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          aria-label={`Amount for ${t.label}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply(1)
          }}
          className={cx(FIELD, 'w-16 px-2 py-1 text-xs')}
        />
        <button type="button" className={cx(SMALL_BUTTON, 'text-rose-200')} disabled={busy || !ok} onClick={() => apply(1)}>
          Damage
        </button>
        <button type="button" className={cx(SMALL_BUTTON, 'text-emerald-200')} disabled={busy || !ok} onClick={() => apply(-1)}>
          Heal
        </button>
      </span>
      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-stone-800" aria-hidden="true">
        <span
          className={cx('block h-full rounded-full', t.down ? 'bg-stone-600' : t.bloodied ? 'bg-rose-500' : 'bg-emerald-500')}
          style={{ width: `${pct}%` }}
        />
      </span>
    </li>
  )
}

export function HpList({ trackers, busy, onChange }: { trackers: Tracker[]; busy: boolean; onChange: (key: string, amount: number) => void }) {
  if (trackers.length === 0) return null
  return (
    <ul className="m-0 list-none flex flex-col gap-1.5 p-0">
      {trackers.map((t) => (
        <HpRow key={t.key} t={t} busy={busy} onChange={(amount) => onChange(t.key, amount)} />
      ))}
    </ul>
  )
}

/** The boss's Bloodied control: follow HP (Auto), or force it on or off. */
export function BloodiedControl({
  bloodied,
  override,
  busy,
  onSet,
}: {
  bloodied: boolean
  override: boolean | null
  busy: boolean
  onSet: (value: boolean | null) => void
}) {
  const options: { label: string; value: boolean | null }[] = [
    { label: 'Auto', value: null },
    { label: 'On', value: true },
    { label: 'Off', value: false },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300">
      <span>
        Bloodied: <strong className={bloodied ? 'text-rose-300' : 'text-stone-100'}>{bloodied ? 'yes' : 'no'}</strong>
        <span className="text-stone-500">{override === null ? ' (from HP)' : ' (set by hand)'}</span>
      </span>
      <span className="inline-flex rounded-lg border border-stone-800 bg-stone-950/80 p-0.5" role="group" aria-label="Boss Bloodied">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={override === o.value}
            disabled={busy}
            onClick={() => onSet(o.value)}
            className={cx(
              'cursor-pointer rounded-md border px-2.5 py-0.5 text-[11px] font-semibold',
              override === o.value ? 'border-rose-500/40 bg-rose-500/20 text-rose-200' : 'border-transparent bg-transparent text-stone-400 hover:text-stone-200',
            )}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  )
}
