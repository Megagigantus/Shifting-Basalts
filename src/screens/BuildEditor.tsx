// The character build (design bible: Character setup): classes and levels,
// subclasses, level 1 orders, homebrew tags, extra training and Weapon Mastery
// picks. Used by the DM's character form and the player's own Build panel.
// The class's own training shows as fixed chips; players tick only extras.
import type { ReactNode } from 'react'
import { BOONS } from '../rules/boons'
import {
  ARMOR_TYPES,
  CLASSES,
  HOMEBREW,
  HOMEBREW_TAG_LIMIT,
  SUBCLASS_LEVEL,
  WEAPON_BASES,
  WEAPON_TOKENS,
  classInfo,
  type BuildFields,
  masteryOptions,
  masteryPicks,
  totalLevel,
  trainingOf,
} from '../rules/build'
import { MAX_LEVEL, proficiencyBonus } from '../rules/proficiency'
import { FIELD, FIELD_LABEL } from '../ui/styles'
import { cx } from '../ui/tone'

/** Tags a homebrew class can pick (Core and Payoff aren't weighted by class). */
const PICKABLE_TAGS = [...new Set(BOONS.flatMap((b) => b.tags))].filter((t) => t !== 'Core' && t !== 'Payoff').sort()
const CUSTOM = '__custom'

const chipClass = (on: boolean, disabled = false) =>
  cx(
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400',
    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    on ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-stone-700 bg-stone-950 text-stone-300',
  )

function Chip({ on, disabled, title, onToggle, children }: { on: boolean; disabled?: boolean; title?: string; onToggle: () => void; children: ReactNode }) {
  return (
    <label className={chipClass(on, disabled)} title={title}>
      <input type="checkbox" className="sr-only" checked={on} disabled={disabled} onChange={onToggle} />
      {children}
    </label>
  )
}

function Group({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 p-0 text-xs font-semibold text-stone-300">
        {legend} {hint && <span className="font-normal text-stone-500">({hint})</span>}
      </legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  )
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

/** Subclass pick: the class's list, or a custom name (other books, homebrew, off-world). */
function SubclassField({ classId, value, onChange, label }: { classId: string; value: string; onChange: (v: string) => void; label: string }) {
  const options = classInfo(classId)?.subclasses ?? []
  const isCustom = value !== '' && !options.includes(value)
  return (
    <label className={FIELD_LABEL}>
      <span>{label}</span>
      {options.length > 0 && (
        <select
          value={isCustom ? CUSTOM : value}
          onChange={(e) => onChange(e.target.value === CUSTOM ? ' ' : e.target.value)}
          className={`${FIELD} w-full`}
        >
          <option value="">None yet</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>
      )}
      {(isCustom || options.length === 0) && (
        <input value={value.trimStart()} onChange={(e) => onChange(e.target.value)} placeholder="Subclass name" className={`${FIELD} w-full`} />
      )}
    </label>
  )
}

function OrderField({ classId, orders, onChange }: { classId: string; orders: Record<string, string>; onChange: (o: Record<string, string>) => void }) {
  const order = classInfo(classId)?.order
  if (!order) return null
  return (
    <label className={FIELD_LABEL}>
      <span>{order.name}</span>
      <select value={orders[classId] ?? ''} onChange={(e) => onChange({ ...orders, [classId]: e.target.value })} className={`${FIELD} w-full`}>
        <option value="">Not chosen</option>
        {order.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )
}

interface Props {
  value: BuildFields
  onChange: (next: BuildFields) => void
  disabled?: boolean
}

export function BuildEditor({ value: b, onChange, disabled }: Props) {
  const set = <K extends keyof BuildFields>(key: K, v: BuildFields[K]) => onChange({ ...b, [key]: v })
  const homebrew = b.classId === HOMEBREW
  const total = totalLevel(b)
  const fixed = trainingOf({ ...b, extraWeapons: [], extraArmor: [] })
  const picks = masteryPicks(b)
  const options = masteryOptions(b)
  const num = (v: number) => (Number.isNaN(v) ? '' : v)

  return (
    <fieldset disabled={disabled} className="m-0 flex flex-col gap-3 border-0 p-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={FIELD_LABEL}>
          <span>Class</span>
          <select value={b.classId} onChange={(e) => set('classId', e.target.value)} className={`${FIELD} w-full`}>
            {CLASSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD_LABEL}>
          <span>Class level</span>
          <input
            type="number"
            min={1}
            max={MAX_LEVEL}
            value={num(b.classLevel)}
            onChange={(e) => set('classLevel', e.target.valueAsNumber)}
            className={`${FIELD} w-full`}
          />
        </label>
        {(b.classLevel >= SUBCLASS_LEVEL || homebrew) && (
          <SubclassField classId={b.classId} value={b.subclass} onChange={(v) => set('subclass', v)} label="Subclass" />
        )}
        <OrderField classId={b.classId} orders={b.classOrders} onChange={(o) => set('classOrders', o)} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={FIELD_LABEL}>
          <span>
            Second class <span className="font-normal text-stone-500">(multiclass)</span>
          </span>
          <select
            value={b.secondClassId}
            onChange={(e) => onChange({ ...b, secondClassId: e.target.value, secondClassLevel: e.target.value ? Math.max(1, b.secondClassLevel) : 0 })}
            className={`${FIELD} w-full`}
          >
            <option value="">None</option>
            {CLASSES.filter((c) => !c.homebrew && c.id !== b.classId).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {b.secondClassId && (
          <>
            <label className={FIELD_LABEL}>
              <span>Second class level</span>
              <input
                type="number"
                min={1}
                max={MAX_LEVEL - 1}
                value={num(b.secondClassLevel)}
                onChange={(e) => set('secondClassLevel', e.target.valueAsNumber)}
                className={`${FIELD} w-full`}
              />
            </label>
            {b.secondClassLevel >= SUBCLASS_LEVEL && (
              <SubclassField classId={b.secondClassId} value={b.secondSubclass} onChange={(v) => set('secondSubclass', v)} label="Second subclass" />
            )}
            <OrderField classId={b.secondClassId} orders={b.classOrders} onChange={(o) => set('classOrders', o)} />
          </>
        )}
      </div>
      <p className="m-0 text-xs text-stone-400">
        Total level {Number.isNaN(total) ? '–' : total}
        {!Number.isNaN(total) && total >= 1 && total <= MAX_LEVEL && ` · PB +${proficiencyBonus(total)}`}
      </p>

      {homebrew && (
        <div className="flex flex-col gap-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-2.5">
          <p className="m-0 text-[0.6875rem] text-fuchsia-100">
            Homebrew: pick your own boon tags. Primary tags weigh ×3 in draft offers, secondary ×2. Up to {HOMEBREW_TAG_LIMIT} of each. A homebrew class
            has no class hidden boon.
          </p>
          {(['primary', 'secondary'] as const).map((band) => (
            <Group key={band} legend={band === 'primary' ? 'Primary tags (×3)' : 'Secondary tags (×2)'} hint={`${b.homebrewTags[band].length} of ${HOMEBREW_TAG_LIMIT}`}>
              {PICKABLE_TAGS.map((tag) => {
                const on = b.homebrewTags[band].includes(tag)
                const other = band === 'primary' ? 'secondary' : 'primary'
                const full = !on && b.homebrewTags[band].length >= HOMEBREW_TAG_LIMIT
                return (
                  <Chip
                    key={tag}
                    on={on}
                    disabled={full || b.homebrewTags[other].includes(tag)}
                    onToggle={() => set('homebrewTags', { ...b.homebrewTags, [band]: toggle(b.homebrewTags[band], tag) })}
                  >
                    {tag}
                  </Chip>
                )
              })}
            </Group>
          ))}
        </div>
      )}

      <Group legend="Weapon training" hint={homebrew ? 'set by hand' : 'from your class, plus anything a feat, species or origin grants'}>
        {WEAPON_TOKENS.map((t) => {
          const fromClass = fixed.weapons.has(t.id)
          return (
            <Chip key={t.id} on={fromClass || b.extraWeapons.includes(t.id)} disabled={fromClass} title={fromClass ? 'From your class' : undefined} onToggle={() => set('extraWeapons', toggle(b.extraWeapons, t.id))}>
              {t.label}
            </Chip>
          )
        })}
      </Group>
      <Group legend="Specific weapons" hint="only if a feat, species or origin grants them one by one">
        {WEAPON_BASES.map((w) => (
          <Chip key={w.id} on={b.extraWeapons.includes(w.id)} onToggle={() => set('extraWeapons', toggle(b.extraWeapons, w.id))}>
            {w.name}
          </Chip>
        ))}
      </Group>
      <Group legend="Armor training">
        {ARMOR_TYPES.map((t) => {
          const fromClass = fixed.armor.has(t.id)
          return (
            <Chip key={t.id} on={fromClass || b.extraArmor.includes(t.id)} disabled={fromClass} title={fromClass ? 'From your class' : undefined} onToggle={() => set('extraArmor', toggle(b.extraArmor, t.id))}>
              {t.label}
            </Chip>
          )
        })}
      </Group>

      {picks > 0 && (
        <Group legend="Weapon Mastery" hint={`${b.masteries.filter((id) => options.some((w) => w.id === id)).length} of ${picks} picks, from weapons you're trained in`}>
          {options.map((w) => {
            const on = b.masteries.includes(w.id)
            return (
              <Chip key={w.id} on={on} disabled={!on && b.masteries.length >= picks} title={`${w.mastery}`} onToggle={() => set('masteries', toggle(b.masteries, w.id))}>
                {w.name} <span className="font-normal opacity-70">{w.mastery}</span>
              </Chip>
            )
          })}
        </Group>
      )}
    </fieldset>
  )
}
