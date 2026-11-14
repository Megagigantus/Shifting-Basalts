// A character's portrait (from the gallery in src/art/portraits) and, for
// characters with a summon, their summon token art (src/art/summons). The
// owning player and the DM can change these any time, even mid-run.
import { useState } from 'react'
import type { Character } from '../model/character'
import { setCharacterLook } from '../characterStore'
import { artIds, artUrl } from '../art'

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

/** A small round portrait for party lists; nothing when there's none. */
export function MiniPortrait({ portrait, name }: { portrait?: string; name: string }) {
  const url = portrait ? artUrl('portraits', portrait) : null
  return url ? <img className="mini-portrait" src={url} alt="" title={name} /> : null
}

export function LookPicker({ character, canEdit = true }: { character: Character; canEdit?: boolean }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const portraits = artIds('portraits')
  const summons = artIds('summons')
  const current = character.portrait ? artUrl('portraits', character.portrait) : null

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
    <div className="look-picker">
      <div className="look-current">
        {current ? <img src={current} alt={`${character.name}'s portrait`} /> : <span className="look-empty">No portrait</span>}
        {canEdit && (
          <button type="button" className="quiet" disabled={saving} onClick={() => setOpen(!open)}>
            {open ? 'Close' : current ? 'Change portrait' : 'Choose a portrait'}
          </button>
        )}
      </div>
      {open && (
        <div className="look-gallery" role="listbox" aria-label="Portraits">
          {portraits.map((id) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={character.portrait === id}
              className={character.portrait === id ? 'is-active' : undefined}
              disabled={saving}
              onClick={() => save({ portrait: id, summonArt: character.summonArt ?? '' })}
            >
              <img src={artUrl('portraits', id)!} alt={id} loading="lazy" />
            </button>
          ))}
          {character.portrait && (
            <button type="button" className="quiet look-clear" disabled={saving} onClick={() => save({ portrait: '', summonArt: character.summonArt ?? '' })}>
              No portrait
            </button>
          )}
        </div>
      )}
      {character.hasSummon && summons.length > 0 && (
        <label className="look-summon">
          Summon token{' '}
          <select
            value={character.summonArt || 'other'}
            disabled={!canEdit || saving}
            onChange={(e) => save({ portrait: character.portrait ?? '', summonArt: e.target.value })}
          >
            {summons.map((id) => (
              <option key={id} value={id}>
                {SUMMON_NAMES[id] ?? id}
              </option>
            ))}
          </select>
          <img src={artUrl('summons', character.summonArt || 'other') ?? undefined} alt="" className="look-summon-art" />
        </label>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
