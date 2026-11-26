// Pure helpers for "The whole story" unlock progress, data access, and part art lookup.
import { artUrl } from '../art'
import rawStory from '../data/lore-whole-story.json'
import { EMBEDDED_LORE_DECK } from './deck'
import { loreImageUrl } from './loreArt'
import type { LoreCard } from './types'

export interface WholeStoryPart {
  title: string
  replayCardId?: string
  readAloud: string
}

export interface WholeStory {
  id: string
  title: string
  staging: string
  parts: WholeStoryPart[]
  coda: string
  codaNote: string
}

/** Typed "The whole story" payload loaded from src/data/lore-whole-story.json. */
export const WHOLE_STORY: WholeStory = rawStory

/** Count non-adHoc deck cards present in `seen` and report whether all are seen. */
export function storyProgress(
  cards: readonly LoreCard[],
  seen: Record<string, number>,
): { seen: number; total: number; unlocked: boolean } {
  const countable = cards.filter((card) => card.adHoc !== true)
  const seenCount = countable.filter((card) => Object.hasOwn(seen, card.id)).length
  const total = countable.length
  return {
    seen: seenCount,
    total,
    unlocked: total > 0 && seenCount === total,
  }
}

/** Picture URL for the whole story itself (used for Opening, fallbacks, and Coda). */
export function wholeStoryImageUrl(): string | null {
  return artUrl('lore', 'whole-story')
}

/**
 * Picture URL for one story part: the replay card's `loreImageUrl` looked up in
 * `EMBEDDED_LORE_DECK` with its group, falling back to `artUrl('lore', 'whole-story')`,
 * or `null` if neither exists.
 */
export function storyPartImageUrl(part: Pick<WholeStoryPart, 'replayCardId'>): string | null {
  const fallback = wholeStoryImageUrl()
  if (!part.replayCardId) return fallback
  const card = EMBEDDED_LORE_DECK.cards.find((entry) => entry.id === part.replayCardId)
  if (!card) return fallback
  const group = EMBEDDED_LORE_DECK.groups.find((entry) => entry.id === card.group)
  return loreImageUrl(card, group) ?? fallback
}
