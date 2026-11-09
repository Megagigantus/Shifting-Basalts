// A character's Banish list and Attunement tag (design bible: Banish, and the
// Attunement upgrade). Editable between runs only; the rules enforce that.
import { useState } from 'react'
import type { Character } from '../model/character'
import { boon, BOONS } from '../rules/boons'
import { setAttuneTag, setBanished } from '../characterStore'

const TAGS = [...new Set(BOONS.flatMap((b) => b.tags))]

interface Props {
  character: Character
  /** False in the DM's read-only player preview. */
  canEdit?: boolean
}

export function DraftPreferences({ character, canEdit = true }: Props) {
  const [adding, setAdding] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const banishRank = character.upgrades.banish ?? 0
  const hasAttunement = (character.upgrades.attunement ?? 0) > 0
  const inRun = Boolean(character.activeRunId)
  const editable = canEdit && !inRun && !busy
  const banished = character.banished ?? []

  if (banishRank === 0 && !hasAttunement) return null

  async function save(work: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await work()
    } catch {
      setError('Could not save. Changes are only allowed between runs.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="draft-preferences">
      <strong>Draft preferences</strong>
      {inRun && <span className="hint"> · locked during a run</span>}

      {banishRank > 0 && (
        <div>
          <div className="hint">
            Banish list ({banished.length} of {banishRank}): these boons never appear in your offers.
          </div>
          <div className="chip-row">
            {banished.map((id) => (
              <span key={id} className="tag">
                {boon(id).name}
                {editable && (
                  <button
                    type="button"
                    className="link"
                    aria-label={`Remove ${boon(id).name} from the Banish list`}
                    onClick={() => save(() => setBanished(character.id, banished.filter((b) => b !== id)))}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {editable && banished.length < banishRank && (
            <div className="boon-picker">
              <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Boon to banish">
                <option value="">Banish a boon…</option>
                {TAGS.map((tag) => (
                  <optgroup key={tag} label={tag}>
                    {BOONS.filter((b) => b.tags[0] === tag && !banished.includes(b.id)).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                disabled={!adding}
                onClick={() =>
                  save(async () => {
                    await setBanished(character.id, [...banished, adding])
                    setAdding('')
                  })
                }
              >
                Banish
              </button>
            </div>
          )}
        </div>
      )}

      {hasAttunement && (
        <label className="attune">
          <span className="hint">Attunement: your first offer each run includes this tag.</span>
          <select
            value={character.attuneTag ?? ''}
            disabled={!editable}
            onChange={(e) => save(() => setAttuneTag(character.id, e.target.value || null))}
            aria-label="Attunement tag"
          >
            <option value="">No tag chosen</option>
            {TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  )
}
