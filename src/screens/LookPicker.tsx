// A character's portrait (from the gallery in src/art/portraits) and, for
// characters with a summon, their summon token art (src/art/summons). The
// owning player and the DM can change these any time, even mid-run.
import { useState } from 'react'
import type { Character } from '../model/character'
import { setCharacterLook } from '../characterStore'
import { artIds, artUrl } from '../art'
import type { PortraitHonors } from '../rules/portraitHonors'
import { Portrait } from '../ui/Portrait'
import { FIELD, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

const SUMMON_NAMES: Record<string, string> = {
  beast: 'Beast',
  spirit: 'Spirit',
  construct: 'Construct',
  undead: 'Undead',
  fey: 'Fey',
  elemental: 'Elemental',
  familiar: 'Familiar',
  other: 'Other',
}

/** A round portrait of a set size, or the character's initials, with any honors (glow, diamonds, book). */
export function Avatar({ portrait, name, size = 'h-10 w-10', honors }: { portrait?: string; name: string; size?: string; honors?: PortraitHonors }) {
  return <Portrait portrait={portrait} name={name} size={size} honors={honors} />
}

export function LookPicker({ character, canEdit = true }: { character: Character; canEdit?: boolean }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const portraits = artIds('portraits')
  const summons = artIds('summons')
  const summonUrl = artUrl('summons', character.summonArt || 'other')

  async function save(look: { portrait: string; summonArt: string }) {
    setSaving(true)
    setError(null)
    try {
      await setCharacterLook(character.id, look)
      setOpen(false)
    } catch {
      setError('Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <button type="button" className={SMALL_BUTTON} disabled={saving} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Close portraits' : character.portrait ? 'Change portrait' : 'Choose a portrait'}
          </button>
        )}
        {character.hasSummon && summons.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-stone-300">
            Summon token
            <select
              value={character.summonArt || 'other'}
              disabled={!canEdit || saving}
              onChange={(e) => save({ portrait: character.portrait ?? '', summonArt: e.target.value })}
              className={cx(FIELD, 'py-1 text-xs')}
            >
              {summons.map((id) => (
                <option key={id} value={id}>
                  {SUMMON_NAMES[id] ?? id}
                </option>
              ))}
            </select>
            {summonUrl && <img src={summonUrl} alt="" className="h-8 w-8 rounded-full border border-teal-500/40 object-cover" />}
          </label>
        )}
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5" role="listbox" aria-label="Portraits">
          {portraits.map((id) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={character.portrait === id}
              disabled={saving}
              onClick={() => save({ portrait: id, summonArt: character.summonArt ?? '' })}
              className={cx(
                'box-border h-12 w-12 cursor-pointer overflow-hidden rounded-lg border-2 bg-stone-950 p-0',
                character.portrait === id ? 'border-amber-400' : 'border-stone-800 hover:border-stone-600',
              )}
            >
              <img src={artUrl('portraits', id)!} alt={id} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
          {character.portrait && (
            <button type="button" className={SMALL_BUTTON} disabled={saving} onClick={() => save({ portrait: '', summonArt: character.summonArt ?? '' })}>
              No portrait
            </button>
          )}
        </div>
      )}
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  )
}
