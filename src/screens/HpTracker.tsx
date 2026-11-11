// DM tools for the fight: an HP row per tracked creature or boss part, and a
// compact ability/save line. Players never see any of this.
import { useState } from 'react'
import type { Tracker } from '../rules/hp'
import { ABILITIES, type Ability } from '../rules/encounters'

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`)
const mod = (score: number) => Math.floor((score - 10) / 2)

/** AC, HP and the six abilities with their saves. */
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
  return (
    <div className="stat-line">
      {ac !== undefined && <span>AC {ac}</span>}
      {hp !== undefined && <span>HP {hp}</span>}
      {ABILITIES.map((a) => (
        <span key={a} title={`${a.toUpperCase()} ${abilities[a]} (${signed(mod(abilities[a]))}), save ${signed(saves[a])}`}>
          <span className="stat-name">{a.toUpperCase()}</span> {abilities[a]} ({signed(mod(abilities[a]))}) · save {signed(saves[a])}
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
    <li className={`hp-row${t.down ? ' is-down' : t.bloodied ? ' is-bloodied' : ''}`}>
      <span className="hp-label">{t.label}</span>
      <span className="hp-numbers">
        {t.current} / {t.max}
      </span>
      <span className="hp-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      {t.down ? <span className="tag hp-down">Down</span> : t.bloodied && <span className="tag hp-bloodied">Bloodied</span>}
      <span className="hp-controls">
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
        />
        <button type="button" className="quiet" disabled={busy || !ok} onClick={() => apply(1)}>
          Damage
        </button>
        <button type="button" className="quiet" disabled={busy || !ok} onClick={() => apply(-1)}>
          Heal
        </button>
      </span>
    </li>
  )
}

export function HpList({ trackers, busy, onChange }: { trackers: Tracker[]; busy: boolean; onChange: (key: string, amount: number) => void }) {
  if (trackers.length === 0) return null
  return (
    <ul className="hp-list">
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
    <div className="bloodied-control">
      <span>
        Bloodied: <strong>{bloodied ? 'yes' : 'no'}</strong>
        {override === null ? ' (from HP)' : ' (set by hand)'}
      </span>
      <span className="segmented" role="group" aria-label="Boss Bloodied">
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            className={override === o.value ? 'is-active' : 'quiet'}
            aria-pressed={override === o.value}
            disabled={busy}
            onClick={() => onSet(o.value)}
          >
            {o.label}
          </button>
        ))}
      </span>
    </div>
  )
}
