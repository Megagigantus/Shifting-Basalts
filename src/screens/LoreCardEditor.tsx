// DM modal for creating or editing a single lore card.
import { useState, type FormEvent } from 'react'
import { loreImageUrl } from '../lore/loreArt'
import { saveCard } from '../lore/loreStore'
import type { LoreCard, LoreGroup, LoreRepeat, LoreSource, LoreTier } from '../lore/types'
import { Modal } from '../ui/Modal'
import { Pill } from '../ui/Pill'
import { FIELD, FIELD_LABEL, PRIMARY_BUTTON, QUIET_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

interface Props {
  card: LoreCard | null
  groups: LoreGroup[]
  seen: boolean
  onClose: () => void
}

const TIER_OPTIONS: { value: LoreTier; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'guarded', label: 'Guarded' },
  { value: 'deep', label: 'Deep' },
]

const REPEAT_OPTIONS: { value: LoreRepeat; label: string }[] = [
  { value: 'once_campaign', label: 'Once per campaign' },
  { value: 'once_run', label: 'Once per run' },
  { value: 'repeatable', label: 'Repeatable' },
]

const SOURCE_OPTIONS: { value: LoreSource; label: string }[] = [
  { value: 'canon', label: 'Canon' },
  { value: 'loremaster', label: 'Loremaster' },
  { value: 'both', label: 'Both' },
]

/** Modal form to create or edit a lore card, validating through saveCard. */
export function LoreCardEditor({ card, groups, seen, onClose }: Props) {
  const isNew = card === null
  const [id, setId] = useState(card?.id ?? '')
  const [title, setTitle] = useState(card?.title ?? '')
  const [group, setGroup] = useState(card?.group ?? groups[0]?.id ?? '')
  const [triggerKey, setTriggerKey] = useState(card?.trigger.key ?? '')
  const [triggerLabel, setTriggerLabel] = useState(card?.trigger.label ?? '')
  const [repeat, setRepeat] = useState<LoreRepeat>(card?.repeat ?? 'once_campaign')
  const [tier, setTier] = useState<LoreTier>(card?.tier ?? 'open')
  const [source, setSource] = useState<LoreSource>(card?.source ?? 'loremaster')
  const [readAloud, setReadAloud] = useState(card?.readAloud ?? '')
  const [push, setPush] = useState(card?.push ?? '')
  const [dmTruth, setDmTruth] = useState(card?.dmTruth ?? '')
  const [placeholdersText, setPlaceholdersText] = useState(card ? card.placeholders.join(', ') : '')
  const [imagePrompt, setImagePrompt] = useState(card?.imagePrompt ?? '')
  const [imageUrl, setImageUrl] = useState(card?.imageUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const trimmedId = isNew ? id.trim() : card.id
  const trimmedImageUrl = imageUrl.trim()
  const activeGroup = groups.find((g) => g.id === group)
  const previewUrl = loreImageUrl(
    { id: trimmedId, group, imageUrl: trimmedImageUrl || null },
    activeGroup,
  )

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return

    const nextCard: LoreCard = {
      id: trimmedId,
      group,
      title,
      trigger: { key: triggerKey, label: triggerLabel },
      repeat,
      tier,
      source,
      readAloud,
      push,
      dmTruth,
      placeholders: placeholdersText
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      imagePrompt,
      imageUrl: trimmedImageUrl || null,
      ...(card?.order !== undefined ? { order: card.order } : {}),
      ...(card?.adHoc !== undefined ? { adHoc: card.adHoc } : {}),
    }

    setSaving(true)
    setErrors([])
    try {
      const validationErrors = await saveCard(nextCard)
      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        return
      }
      onClose()
    } catch (err) {
      setErrors([err instanceof Error && err.message ? err.message : 'Could not save the card.'])
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{isNew ? 'New lore card' : `Edit ${card.title || card.id}`}</span>
          {seen && <Pill tone="emerald">Seen</Pill>}
        </span>
      }
    >
      <form className="flex flex-col gap-3" noValidate onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={FIELD_LABEL}>
            <span>ID (lowercase letters, digits, dashes)</span>
            <input
              type="text"
              value={id}
              disabled={!isNew}
              onChange={(e) => setId(e.target.value)}
              placeholder="fractured-stride-gate"
              className={cx(FIELD, 'w-full font-mono')}
            />
          </label>
          <label className={FIELD_LABEL}>
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cx(FIELD, 'w-full')}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={FIELD_LABEL}>
            <span>Group</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className={cx(FIELD, 'w-full')}>
              {groups.length === 0 && <option value="">No groups yet</option>}
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || g.id}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD_LABEL}>
            <span>Tier</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as LoreTier)} className={cx(FIELD, 'w-full')}>
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD_LABEL}>
            <span>Repeat</span>
            <select value={repeat} onChange={(e) => setRepeat(e.target.value as LoreRepeat)} className={cx(FIELD, 'w-full')}>
              {REPEAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD_LABEL}>
            <span>Source</span>
            <select value={source} onChange={(e) => setSource(e.target.value as LoreSource)} className={cx(FIELD, 'w-full')}>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={FIELD_LABEL}>
            <span>Trigger key</span>
            <input
              type="text"
              value={triggerKey}
              onChange={(e) => setTriggerKey(e.target.value)}
              className={cx(FIELD, 'w-full font-mono')}
            />
          </label>
          <label className={FIELD_LABEL}>
            <span>Trigger label</span>
            <input
              type="text"
              value={triggerLabel}
              onChange={(e) => setTriggerLabel(e.target.value)}
              className={cx(FIELD, 'w-full')}
            />
          </label>
        </div>

        <label className={FIELD_LABEL}>
          <span>Read aloud</span>
          <textarea
            rows={3}
            value={readAloud}
            onChange={(e) => setReadAloud(e.target.value)}
            className={cx(FIELD, 'w-full')}
          />
        </label>

        <label className={FIELD_LABEL}>
          <span>Placeholders (comma-separated)</span>
          <input
            type="text"
            value={placeholdersText}
            onChange={(e) => setPlaceholdersText(e.target.value)}
            placeholder="item, floor"
            className={cx(FIELD, 'w-full font-mono')}
          />
        </label>

        <label className={FIELD_LABEL}>
          <span>If they push</span>
          <textarea
            rows={3}
            value={push}
            onChange={(e) => setPush(e.target.value)}
            className={cx(FIELD, 'w-full')}
          />
        </label>

        <label className={FIELD_LABEL}>
          <span className="inline-flex items-center gap-2">
            <span>DM truth</span>
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-rose-400">DM only</span>
          </span>
          <textarea
            rows={3}
            value={dmTruth}
            onChange={(e) => setDmTruth(e.target.value)}
            className={cx(FIELD, 'w-full border-rose-500/50 bg-rose-950/20 focus:border-rose-400')}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="flex flex-col gap-1.5 sm:col-span-5">
            <span className="text-xs font-semibold text-stone-300">Image preview</span>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-stone-800 bg-stone-950">
              {previewUrl && <img src={previewUrl} alt="" className="block h-full w-full object-cover" />}
            </div>
            <p className="m-0 break-all text-[0.6875rem] text-stone-400">
              Art file: src/art/lore/{trimmedId || '<id>'}.webp (falls back to the group picture)
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:col-span-7">
            <label className={FIELD_LABEL}>
              <span>Image URL (optional)</span>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className={cx(FIELD, 'w-full')}
              />
            </label>
            <label className={FIELD_LABEL}>
              <span>Image prompt</span>
              <textarea
                rows={3}
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                className={cx(FIELD, 'w-full')}
              />
            </label>
          </div>
        </div>

        {errors.length > 0 && (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            <ul className="m-0 flex max-h-40 list-disc flex-col gap-1 overflow-y-auto pl-4">
              {errors.map((err, i) => (
                <li key={`${i}-${err}`}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-800 pt-3">
          <button type="button" onClick={onClose} className={QUIET_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
