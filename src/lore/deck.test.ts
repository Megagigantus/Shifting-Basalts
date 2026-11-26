import { describe, expect, it } from 'vitest'
import rawDeck from '../data/lore-deck.json'
import { findBannedInCard, findBannedTerms } from './bannedTerms.ts'
import {
  EMBEDDED_LORE_DECK,
  EMBEDDED_LORE_SUMMARY,
  LORE_BANNED_TERMS,
  withAdHocCards,
} from './deck.ts'
import type { LoreCard } from './types.ts'

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
    push: `Push for ${id}.`,
    dmTruth: `DM truth for ${id}.`,
    placeholders: [],
    imagePrompt: 'Basalt columns in dramatic light.',
    imageUrl: null,
    ...overrides,
  }
}

describe('embedded lore deck', () => {
  it('validates with at least one group and one card and assigns card order', () => {
    expect(EMBEDDED_LORE_DECK.schemaVersion).toBe(1)
    expect(EMBEDDED_LORE_DECK.groups.length).toBeGreaterThan(0)
    expect(EMBEDDED_LORE_DECK.cards.length).toBeGreaterThan(0)
    expect(EMBEDDED_LORE_DECK.cards.every((card, index) => card.order === index)).toBe(true)
  })

  it('references only known groups on every card', () => {
    const groupIds = new Set(EMBEDDED_LORE_DECK.groups.map((group) => group.id))
    const unknownGroups = EMBEDDED_LORE_DECK.cards
      .filter((card) => !groupIds.has(card.group))
      .map((card) => `${card.id}: ${card.group}`)

    expect(unknownGroups).toEqual([])
  })

  it('includes required banned terms in LORE_BANNED_TERMS', () => {
    expect(LORE_BANNED_TERMS).toContain('sonder')
    expect(LORE_BANNED_TERMS).toContain('thilsavrass')
    expect(LORE_BANNED_TERMS).toContain('lorebook')
  })

  it('contains no banned terms in raw cards outside readAloud', () => {
    const hits = rawDeck.cards.flatMap((card) =>
      findBannedInCard(card as unknown as LoreCard, LORE_BANNED_TERMS).map(
        (hit) => `${card.id} (${hit.path}): ${hit.term}`,
      ),
    )

    expect(hits, `Banned terms found in cards:\n${hits.join('\n')}`).toEqual([])
  })

  it('contains no banned terms in groups or settings', () => {
    const groupHits = rawDeck.groups.flatMap((group) =>
      findBannedTerms(group, LORE_BANNED_TERMS).map(
        (hit) => `${group.id} (${hit.path}): ${hit.term}`,
      ),
    )
    const settingHits = findBannedTerms(rawDeck.settings, LORE_BANNED_TERMS).map(
      (hit) => `settings.${hit.path}: ${hit.term}`,
    )

    expect(groupHits, `Banned terms found in groups:\n${groupHits.join('\n')}`).toEqual([])
    expect(settingHits, `Banned terms found in settings:\n${settingHits.join('\n')}`).toEqual([])
  })

  it('computes EMBEDDED_LORE_SUMMARY.total as the count of non-adHoc embedded cards', () => {
    const expectedTotal = EMBEDDED_LORE_DECK.cards.filter((card) => card.adHoc !== true).length
    expect(EMBEDDED_LORE_SUMMARY.total).toBe(expectedTotal)
  })
})

describe('withAdHocCards', () => {
  it('keeps unique ad hoc stored cards sorted by order then id and leaves inputs unchanged', () => {
    const embedded: LoreCard[] = [
      makeCard('emb-b', { order: 1 }),
      makeCard('emb-a', { order: 0 }),
    ]
    const stored: LoreCard[] = [
      makeCard('adhoc-no-order-b', { adHoc: true }),
      makeCard('non-adhoc-1', { adHoc: false, order: 0 }),
      makeCard('non-adhoc-2', { order: 0 }),
      makeCard('emb-a', { adHoc: true, order: 0 }),
      makeCard('adhoc-order-2-b', { adHoc: true, order: 2 }),
      makeCard('adhoc-order-2-a', { adHoc: true, order: 2 }),
      makeCard('adhoc-inf', { adHoc: true, order: Number.POSITIVE_INFINITY }),
      makeCard('adhoc-order-1', { adHoc: true, order: 1 }),
      makeCard('adhoc-no-order-a', { adHoc: true }),
    ]

    const embeddedSnapshot = embedded.map((card) => ({ ...card }))
    const storedSnapshot = stored.map((card) => ({ ...card }))

    const merged = withAdHocCards(embedded, stored)

    expect(merged.map((card) => card.id)).toEqual([
      'emb-b',
      'emb-a',
      'adhoc-order-1',
      'adhoc-order-2-a',
      'adhoc-order-2-b',
      'adhoc-inf',
      'adhoc-no-order-a',
      'adhoc-no-order-b',
    ])
    expect(embedded).toEqual(embeddedSnapshot)
    expect(stored).toEqual(storedSnapshot)
  })
})
