// DM read-only modal for viewing a single lore card and queuing it for reveal.
import { useState } from 'react'
import { loreImageUrl } from '../lore/loreArt'
import { queueReplay } from '../lore/revealStore'
import type { LoreCard, LoreGroup, LoreRepeat, LoreSource, LoreTier } from '../lore/types'
import { useActiveRun } from '../runStore'
import { Modal } from '../ui/Modal'
import { SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { PRIMARY_BUTTON, QUIET_BUTTON } from '../ui/styles'
import type { Tone } from '../ui/tone'

export const TIER_TONE: Record<LoreTier, Tone> = {
  open: 'stone',
  guarded: 'amber',
  deep: 'violet',
}

export const TIER_LABEL: Record<LoreTier, string> = {
  open: 'Open',
  guarded: 'Guarded',
  deep: 'Deep',
}

export const SOURCE_LABEL: Record<LoreSource, string> = {
  canon: 'Canon',
  loremaster: 'Loremaster',
  both: 'Both',
}

export const REPEAT_LABEL: Record<LoreRepeat, string> = {
  once_campaign: 'Once/campaign',
  once_run: 'Once/run',
  repeatable: 'Repeatable',
}

interface Props {
  card: LoreCard
  group: LoreGroup | undefined
  seen: boolean
  onClose: () => void
}

/** Read-only modal showing every field of a lore card, with a button to queue it for reveal. */
export function LoreCardView({ card, group, seen, onClose }: Props) {
  const { state: activeRun } = useActiveRun()
  const [revealing, setRevealing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const imageUrl = loreImageUrl(card, group)
  const hasReadAloud = card.readAloud.trim().length > 0
  const hasPush = card.push.trim().length > 0
  const hasDmTruth = card.dmTruth.trim().length > 0
  const placeholders = card.placeholders.map((entry) => entry.trim()).filter(Boolean)
  const hasImagePrompt = card.imagePrompt.trim().length > 0

  async function handleRevealNow() {
    if (!activeRun || revealing) return
    setRevealing(true)
    setError(null)
    try {
      await queueReplay(activeRun.run.id, card.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not queue the card for reveal.')
    } finally {
      setRevealing(false)
    }
  }

  return (
    <Modal
      wide
      onClose={onClose}
      title={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{card.title || card.id}</span>
          {seen && <Pill tone="emerald">Seen</Pill>}
          {card.adHoc && <Pill tone="sky">Written in play</Pill>}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {imageUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-stone-800 bg-stone-950">
            <img src={imageUrl} alt="" className="block h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-300">
          <span>{group?.name || card.group}</span>
          <span aria-hidden="true" className="text-stone-600">·</span>
          <Pill tone={TIER_TONE[card.tier]}>{TIER_LABEL[card.tier]}</Pill>
          <span aria-hidden="true" className="text-stone-600">·</span>
          <span>{REPEAT_LABEL[card.repeat]}</span>
          <span aria-hidden="true" className="text-stone-600">·</span>
          <span>{SOURCE_LABEL[card.source]}</span>
          {(card.trigger.label || card.trigger.key) && (
            <>
              <span aria-hidden="true" className="text-stone-600">·</span>
              <span>
                {card.trigger.label}
                {card.trigger.key && (
                  <span className="ml-1.5 font-mono text-[0.6875rem] text-stone-500">
                    {card.trigger.key}
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        {hasReadAloud && (
          <div className="flex flex-col gap-1">
            <SectionLabel>Read aloud</SectionLabel>
            <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-stone-100">{card.readAloud}</p>
          </div>
        )}

        {hasPush && (
          <div className="flex flex-col gap-1">
            <SectionLabel>If they push</SectionLabel>
            <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-stone-200">{card.push}</p>
          </div>
        )}

        {hasDmTruth && (
          <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-950/20 p-3">
            <h3 className="m-0 text-[0.625rem] font-bold uppercase tracking-wider text-amber-300">
              DM truth (never shown to players)
            </h3>
            <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-stone-100">{card.dmTruth}</p>
          </div>
        )}

        {placeholders.length > 0 && (
          <div className="flex flex-col gap-1">
            <SectionLabel>Placeholders</SectionLabel>
            <p className="m-0 font-mono text-xs text-stone-300">{placeholders.join(', ')}</p>
          </div>
        )}

        {hasImagePrompt && (
          <div className="flex flex-col gap-1">
            <SectionLabel>Image prompt</SectionLabel>
            <p className="m-0 whitespace-pre-line text-xs text-stone-400">{card.imagePrompt}</p>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-800 pt-3">
          {!activeRun && (
            <span className="mr-auto text-xs text-stone-400">Start a run to reveal cards.</span>
          )}
          <button type="button" onClick={onClose} disabled={revealing} className={QUIET_BUTTON}>
            Close
          </button>
          <button
            type="button"
            disabled={!activeRun || revealing}
            onClick={handleRevealNow}
            className={PRIMARY_BUTTON}
          >
            {revealing ? 'Queuing…' : 'Reveal now'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
