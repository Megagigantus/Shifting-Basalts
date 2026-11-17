// A character's Banish list and Attunement tag (design bible: Banish, and the
// Attunement upgrade). Editable between runs only; the rules enforce that.
import { useState } from 'react'
import type { Character } from '../model/character'
import { boon, BOONS } from '../rules/boons'
import { setAttuneTag, setBanished } from '../characterStore'
import { Pill } from '../ui/Pill'
import { FIELD, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

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
  const historySet = new Set([...(character.banishHistory ?? []), ...banished])
  const availableBoons = BOONS.filter((b) => historySet.has(b.id) && !banished.includes(b.id))
  const availableGroups = TAGS.map((tag) => ({
    tag,
    boons: availableBoons.filter((b) => b.tags[0] === tag),
  })).filter((g) => g.boons.length > 0)
  const selectedAdding = availableBoons.some((b) => b.id === adding) ? adding : ''

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
    <div className="flex flex-col gap-2 rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-stone-400">Draft preferences</span>
        {inRun && <Pill>Locked during a run</Pill>}
      </div>

      {banishRank > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.6875rem] text-stone-400">
            Banish list ({banished.length} of {banishRank}): these boons never appear in your offers. Banish new boons from a draft offer; between runs, swap among boons you've banished before.
          </span>
          {banished.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {banished.map((id) => (
                <Pill key={id} tone="rose">
                  {boon(id).name}
                  {editable && (
                    <button
                      type="button"
                      className="ml-0.5 cursor-pointer border-0 bg-transparent p-0 text-rose-200 hover:text-white"
                      aria-label={`Remove ${boon(id).name} from the Banish list`}
                      onClick={() => save(() => setBanished(character.id, banished.filter((b) => b !== id)))}
                    >
                      ×
                    </button>
                  )}
                </Pill>
              ))}
            </div>
          )}
          {editable && banished.length < banishRank && (
            availableGroups.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <select value={selectedAdding} onChange={(e) => setAdding(e.target.value)} aria-label="Boon to banish" className={cx(FIELD, 'min-w-0 flex-1 py-1.5 text-xs')}>
                  <option value="">Banish a boon…</option>
                  {availableGroups.map(({ tag, boons }) => (
                    <optgroup key={tag} label={tag}>
                      {boons.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  className={SMALL_BUTTON}
                  disabled={!selectedAdding}
                  onClick={() =>
                    save(async () => {
                      await setBanished(character.id, [...banished, selectedAdding])
                      setAdding('')
                    })
                  }
                >
                  Banish
                </button>
              </div>
            ) : (
              <span className="text-[0.6875rem] text-stone-400">Banish a boon from a draft offer to add it here.</span>
            )
          )}
        </div>
      )}

      {hasAttunement && (
        <label className="flex flex-col gap-1">
          <span className="text-[0.6875rem] text-stone-400">Attunement: your first offer each run includes this tag.</span>
          <select
            value={character.attuneTag ?? ''}
            disabled={!editable}
            onChange={(e) => save(() => setAttuneTag(character.id, e.target.value || null))}
            aria-label="Attunement tag"
            className={cx(FIELD, 'py-1.5 text-xs')}
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

      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  )
}
