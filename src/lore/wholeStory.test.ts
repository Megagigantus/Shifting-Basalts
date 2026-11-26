// Tests for wholeStory data integrity, banned-term safety, unlock progress, and part art lookup.
import { describe, expect, it } from 'vitest'
import { artUrl } from '../art'
import { findBannedTerms } from './bannedTerms'
import { EMBEDDED_LORE_DECK, LORE_BANNED_TERMS } from './deck'
import type { LoreCard } from './types'
import { WHOLE_STORY, storyPartImageUrl, storyProgress } from './wholeStory'

function makeCard(id: string, overrides: Partial<LoreCard> = {}): LoreCard {
  return {
    id,
    group: 'arrival',
    title: `Card ${id}`,
    trigger: { key: 'dispatch', label: 'Dispatch trigger' },
    repeat: 'once_campaign',
    tier: 'open',
    source: 'loremaster',
    readAloud: `Read aloud for ${id}.`,
    push: '',
    dmTruth: '',
    placeholders: [],
    imageUrl: null,
    ...overrides,
  }
}

describe('WHOLE_STORY', () => {
  it('references only existing cards from EMBEDDED_LORE_DECK in replayCardId', () => {
    const cardIds = new Set(EMBEDDED_LORE_DECK.cards.map((card) => card.id))
    const missing = WHOLE_STORY.parts
      .filter((part) => part.replayCardId !== undefined && !cardIds.has(part.replayCardId))
      .map((part) => `${part.title}: ${part.replayCardId}`)

    expect(missing).toEqual([])
  })

  it('contains no banned terms', () => {
    const hits = findBannedTerms(WHOLE_STORY, LORE_BANNED_TERMS).map(
      (hit) => `${hit.path}: ${hit.term}`,
    )

    expect(hits, `Banned terms found in whole story:\n${hits.join('\n')}`).toEqual([])
  })
})

describe('storyProgress', () => {
  it('counts only non-adHoc cards and unlocks only when all are seen', () => {
    const cards: LoreCard[] = [
      makeCard('c-1'),
      makeCard('c-2', { adHoc: false }),
      makeCard('adhoc-1', { adHoc: true }),
    ]

    expect(storyProgress(cards, {})).toEqual({ seen: 0, total: 2, unlocked: false })
    expect(storyProgress(cards, { 'adhoc-1': 100 })).toEqual({ seen: 0, total: 2, unlocked: false })
    expect(storyProgress(cards, { 'c-1': 100, 'adhoc-1': 200 })).toEqual({
      seen: 1,
      total: 2,
      unlocked: false,
    })
    expect(storyProgress(cards, { 'c-1': 100, 'c-2': 200 })).toEqual({
      seen: 2,
      total: 2,
      unlocked: true,
    })
    expect(storyProgress([makeCard('adhoc-only', { adHoc: true })], { 'adhoc-only': 1 })).toEqual({
      seen: 0,
      total: 0,
      unlocked: false,
    })
  })
})

describe('storyPartImageUrl', () => {
  it('returns the whole-story art for Opening and the boss art for boss-gatewright', () => {
    const opening = WHOLE_STORY.parts[0]
    const gatewrightPart = WHOLE_STORY.parts.find((part) => part.replayCardId === 'boss-gatewright')

    expect(opening?.replayCardId).toBeUndefined()
    expect(storyPartImageUrl(opening)).toBe(artUrl('lore', 'whole-story'))

    expect(gatewrightPart).toBeDefined()
    if (!gatewrightPart) throw new Error('Expected a part with replayCardId boss-gatewright')
    expect(storyPartImageUrl(gatewrightPart)).toBe(artUrl('bosses', 'gatewright'))
  })

  it('falls back to the whole-story art when a replayCardId is not in the deck', () => {
    expect(storyPartImageUrl({ replayCardId: 'nonexistent-card-id' })).toBe(
      artUrl('lore', 'whole-story'),
    )
  })
})
