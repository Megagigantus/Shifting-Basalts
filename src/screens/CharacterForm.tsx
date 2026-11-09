// Create or edit a character's lean profile.
import { useState, type FormEvent } from 'react'
import classes from '../data/classes.json'
import {
  ATTACK_STYLES,
  CASTER_TYPES,
  type CasterType,
  type CharacterProfile,
  type AttackStyle,
} from '../model/character'
import { MAX_LEVEL, MIN_ENTRY_LEVEL, proficiencyBonus } from '../rules/proficiency'
import classTags from '../data/class-tags.json'
import { BOONS } from '../rules/boons'

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
// Tags a subclass might favor (Core and Payoff aren't weighted by class).
const FAVORABLE_TAGS = [...new Set(BOONS.flatMap((b) => b.tags))].filter((t) => t !== 'Core' && t !== 'Payoff')
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`

interface Props {
  initial: CharacterProfile
  title: string
  onSave: (profile: CharacterProfile) => Promise<void>
  onCancel: () => void
}

export function CharacterForm({ initial, title, onSave, onCancel }: Props) {
  const [profile, setProfile] = useState<CharacterProfile>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof CharacterProfile>(key: K, value: CharacterProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))

  function setCasterType(casterType: CasterType) {
    // Non-casters have no slots, so clear any that were ticked.
    setProfile((p) => ({ ...p, casterType, slotLevels: casterType === 'none' ? [] : p.slotLevels }))
  }

  function toggleSlot(level: number) {
    setProfile((p) => ({
      ...p,
      slotLevels: p.slotLevels.includes(level)
        ? p.slotLevels.filter((l) => l !== level)
        : [...p.slotLevels, level].sort((a, b) => a - b),
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const cleaned: CharacterProfile = {
      ...profile,
      name: profile.name.trim(),
      subclass: profile.subclass.trim(),
      playerEmail: profile.playerEmail.trim().toLowerCase(),
    }
    if (!cleaned.name) return setError('Give the character a name.')
    if (!Number.isInteger(cleaned.level) || cleaned.level < MIN_ENTRY_LEVEL || cleaned.level > MAX_LEVEL) {
      return setError(`Level must be a whole number from ${MIN_ENTRY_LEVEL} to ${MAX_LEVEL}.`)
    }
    if (cleaned.playerEmail && !EMAIL_PATTERN.test(cleaned.playerEmail)) {
      return setError('The player email doesn\'t look like an email address.')
    }
    if (cleaned.casterType !== 'none' && cleaned.slotLevels.length === 0) {
      return setError('Tick at least one spell slot level, or set caster type to None.')
    }
    setError(null)
    setSaving(true)
    try {
      await onSave(cleaned)
    } catch {
      setError('Could not save the character. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form className="character-form" onSubmit={submit}>
      <h3>{title}</h3>

      <label>
        Name
        <input value={profile.name} onChange={(e) => set('name', e.target.value)} required />
      </label>

      <div className="form-row">
        <label>
          Class
          <select value={profile.classId} onChange={(e) => set('classId', e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Subclass
          <input value={profile.subclass} onChange={(e) => set('subclass', e.target.value)} />
        </label>
      </div>

      <div className="form-row">
        <label>
          Level
          <input
            type="number"
            min={MIN_ENTRY_LEVEL}
            max={MAX_LEVEL}
            value={Number.isNaN(profile.level) ? '' : profile.level}
            onChange={(e) => set('level', e.target.valueAsNumber)}
            required
          />
        </label>
        <div className="readout">
          PB
          <strong>+{proficiencyBonus(Number.isNaN(profile.level) ? MIN_ENTRY_LEVEL : profile.level)}</strong>
        </div>
        <label>
          Main attack style
          <select
            value={profile.attackStyle}
            onChange={(e) => set('attackStyle', e.target.value as AttackStyle)}
          >
            {ATTACK_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Caster type
        <select value={profile.casterType} onChange={(e) => setCasterType(e.target.value as CasterType)}>
          {CASTER_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {profile.casterType !== 'none' && (
        <fieldset className="slot-levels">
          <legend>Spell slot levels available</legend>
          {SLOT_LEVELS.map((level) => (
            <label key={level} className="checkbox">
              <input
                type="checkbox"
                checked={profile.slotLevels.includes(level)}
                onChange={() => toggleSlot(level)}
              />
              {ordinal(level)}
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="slot-levels">
        <legend>
          Extra favored tags <span className="hint">(optional, for subclasses: weighted like the class's primary tags)</span>
        </legend>
        {FAVORABLE_TAGS.map((tag) => {
          const fromClass = classTags.classes.find((c) => c.classId === profile.classId)?.primary.includes(tag)
          return (
            <label key={tag} className={`checkbox ${fromClass ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={fromClass || profile.favoredTags.includes(tag)}
                disabled={fromClass}
                onChange={() =>
                  set(
                    'favoredTags',
                    profile.favoredTags.includes(tag)
                      ? profile.favoredTags.filter((t) => t !== tag)
                      : [...profile.favoredTags, tag],
                  )
                }
              />
              {tag}
            </label>
          )
        })}
      </fieldset>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={profile.hasSummon}
          onChange={(e) => set('hasSummon', e.target.checked)}
        />
        Has a summon or companion
      </label>

      <label>
        Player's Google email <span className="hint">(optional, used when players join)</span>
        <input
          type="email"
          value={profile.playerEmail}
          onChange={(e) => set('playerEmail', e.target.value)}
          placeholder="player@gmail.com"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
