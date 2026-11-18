// Create or edit a character's lean profile.
import { useState, type FormEvent } from 'react'
import {
  ATTACK_STYLES,
  CASTER_TYPES,
  type CasterType,
  type CharacterProfile,
  type AttackStyle,
} from '../model/character'
import { MIN_ENTRY_LEVEL } from '../rules/proficiency'
import { buildError, cleanBuild, totalLevel, type BuildFields } from '../rules/build'
import { BuildEditor } from './BuildEditor'
import classTags from '../data/class-tags.json'
import { tagInfo } from '../tagInfo'
import { BOONS } from '../rules/boons'
import { FIELD, FIELD_LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

// Tags a subclass might favor (Core and Payoff aren't weighted by class).
const FAVORABLE_TAGS = [...new Set(BOONS.flatMap((b) => b.tags))].filter((t) => t !== 'Core' && t !== 'Payoff')
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Props {
  initial: CharacterProfile
  onSave: (profile: CharacterProfile) => Promise<void>
  onCancel: () => void
}

export function CharacterForm({ initial, onSave, onCancel }: Props) {
  const [profile, setProfile] = useState<CharacterProfile>(initial)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof CharacterProfile>(key: K, value: CharacterProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))

  function setCasterType(casterType: CasterType) {
    set('casterType', casterType)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const build = cleanBuild(profile)
    const cleaned: CharacterProfile = {
      ...profile,
      ...build,
      level: totalLevel(build),
      name: profile.name.trim(),
      playerEmail: profile.playerEmail.trim().toLowerCase(),
    }
    if (!cleaned.name) return setError('Give the character a name.')
    const problem = buildError(build, MIN_ENTRY_LEVEL)
    if (problem) return setError(problem)
    if (cleaned.playerEmail && !EMAIL_PATTERN.test(cleaned.playerEmail)) {
      return setError('The player email doesn\'t look like an email address.')
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

  const chip = (on: boolean, disabled = false) =>
    cx(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400',
      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      on ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-stone-700 bg-stone-950 text-stone-300',
    )

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`${FIELD_LABEL} sm:col-span-2`}>
          <span>Name</span>
          <input value={profile.name} onChange={(e) => set('name', e.target.value)} required className={`${FIELD} w-full`} />
        </label>
        <label className={FIELD_LABEL}>
          <span>Main attack style</span>
          <select value={profile.attackStyle} onChange={(e) => set('attackStyle', e.target.value as AttackStyle)} className={`${FIELD} w-full`}>
            {ATTACK_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD_LABEL}>
          <span>Caster type</span>
          <select value={profile.casterType} onChange={(e) => setCasterType(e.target.value as CasterType)} className={`${FIELD} w-full`}>
            {CASTER_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD_LABEL}>
          <span>
            Player's email <span className="font-normal text-stone-500">(optional)</span>
          </span>
          <input
            type="email"
            value={profile.playerEmail}
            onChange={(e) => set('playerEmail', e.target.value)}
            placeholder="player@gmail.com"
            className={`${FIELD} w-full`}
          />
        </label>
      </div>

      <BuildEditor value={profile} onChange={(b: BuildFields) => setProfile((p) => ({ ...p, ...b }))} />

      <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
        <legend className="mb-1.5 p-0 text-xs font-semibold text-stone-300">
          Extra favored tags <span className="font-normal text-stone-500">(optional, for subclasses: weighted like the class's primary tags)</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {FAVORABLE_TAGS.map((tag) => {
            const fromClass = Boolean(classTags.classes.find((c) => c.classId === profile.classId)?.primary.includes(tag))
            const on = fromClass || profile.favoredTags.includes(tag)
            return (
              <label key={tag} className={chip(on, fromClass)} title={[tagInfo(tag), fromClass ? "Already one of the class's primary tags." : ''].filter(Boolean).join(' ')}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  disabled={fromClass}
                  onChange={() =>
                    set(
                      'favoredTags',
                      profile.favoredTags.includes(tag) ? profile.favoredTags.filter((t) => t !== tag) : [...profile.favoredTags, tag],
                    )
                  }
                />
                {tag}
              </label>
            )
          })}
        </div>
      </fieldset>

      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-stone-200">
        <input type="checkbox" checked={profile.hasSummon} onChange={(e) => set('hasSummon', e.target.checked)} />
        Has a summon or companion
      </label>

      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className={QUIET_BUTTON}>
          Cancel
        </button>
      </div>
    </form>
  )
}
