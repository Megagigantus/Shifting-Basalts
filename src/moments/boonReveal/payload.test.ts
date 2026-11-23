import { describe, expect, it } from 'vitest'
import { emptySlots } from '../../rules/boons'
import { cardFromHidden, cardFromOffer, type RevealCard } from '../revealTier'
import { THEME, type MomentTheme } from '../theme'
import {
  type BoonRevealPayload,
  cardsForViewer,
  cardText,
  describeReveal,
  revealAssets,
  revealDurationMs,
  revealEstimateMs,
  sampleRevealAllTiers,
  sampleRevealThils,
} from './payload'

function findUndefinedPaths(value: unknown, path = 'root'): string[] {
  if (value === undefined) return [path]
  if (value === null || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findUndefinedPaths(item, `${path}[${index}]`))
  }
  return Object.entries(value).flatMap(([key, entry]) =>
    findUndefinedPaths(entry, `${path}.${key}`),
  )
}

function makePayload(offers: Record<string, RevealCard[]>, names: Record<string, string> = {}): BoonRevealPayload {
  return {
    kind: 'draft',
    offers,
    names,
    conditionText: null,
    partyWide: false,
  }
}

describe('cardsForViewer', () => {
  it('returns the first character with cards, skips empty characters, and returns null if none match', () => {
    const card = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
    const payload = makePayload({
      emptyChar: [],
      secondChar: [card],
      thirdChar: [card],
    })

    expect(cardsForViewer(payload, ['secondChar', 'thirdChar'])).toEqual({
      characterId: 'secondChar',
      cards: [card],
    })
    expect(cardsForViewer(payload, ['missingChar', 'emptyChar', 'secondChar'])).toEqual({
      characterId: 'secondChar',
      cards: [card],
    })
    expect(cardsForViewer(payload, ['missingChar', 'emptyChar'])).toBeNull()
    expect(cardsForViewer(payload, [])).toBeNull()
  })
})

describe('cardText', () => {
  it('formats name, tier label, level tick, and detail for every reveal tier', () => {
    const newCard = cardFromOffer({ kind: 'boon', boonId: 'critical-delight', source: 'weighted' }, emptySlots(3))
    expect(cardText(newCard)).toEqual({
      name: 'Critical Delight',
      label: 'New',
      detail: null,
    })

    const deepenedCard = cardFromOffer(
      { kind: 'boon', boonId: 'crits-are-for-suckers', source: 'held' },
      [{ kind: 'boon', boonId: 'crits-are-for-suckers', level: 2 }, null, null],
    )
    expect(cardText(deepenedCard)).toEqual({
      name: 'Crits Are for Suckers',
      label: 'Deepened · Level 2 → 3',
      detail: null,
    })

    const fusedCard = cardFromOffer(
      { kind: 'combination', combinationId: 'super-normal', source: 'wildcard' },
      emptySlots(3),
    )
    expect(cardText(fusedCard)).toEqual({
      name: 'Super Normal',
      label: 'Fused',
      detail: 'Critical Delight + Crits Are for Suckers',
    })

    const evolvedCard = cardFromOffer(
      { kind: 'evolution', evolutionId: 'ball-of-yarn', slotIndex: 0, source: 'wildcard' },
      [{ kind: 'boon', boonId: 'ulmas-thread', level: 3 }, null, null],
    )
    expect(cardText(evolvedCard)).toEqual({
      name: 'Ball of Yarn',
      label: 'Evolved',
      detail: "from Ulma's Thread",
    })

    const hiddenWithCondition = cardFromHidden('unbroken', 'Hit with every attack you made in a room.')
    expect(cardText(hiddenWithCondition)).toEqual({
      name: 'Unbroken',
      label: 'Hidden',
      detail: 'Hit with every attack you made in a room.',
    })

    const hiddenWithoutCondition = cardFromHidden('keeper-of-ways', null)
    expect(cardText(hiddenWithoutCondition)).toEqual({
      name: 'Keeper of Ways',
      label: 'Hidden',
      detail: null,
    })
  })
})

describe('revealDurationMs and revealEstimateMs', () => {
  const newCard = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
  const deepenedCard = cardFromOffer(
    { kind: 'boon', boonId: 'honed', source: 'held' },
    [{ kind: 'boon', boonId: 'honed', level: 2 }, null, null],
  )
  const fusedCard = cardFromOffer(
    { kind: 'combination', combinationId: 'super-normal', source: 'wildcard' },
    emptySlots(3),
  )
  const evolvedCard = cardFromOffer(
    { kind: 'evolution', evolutionId: 'ball-of-yarn', slotIndex: 0, source: 'wildcard' },
    emptySlots(3),
  )

  it('keeps a normal 4-card reveal under 6000ms and grows when an evolved card is added', () => {
    const normalHand = [newCard, newCard, deepenedCard, fusedCard]
    const normalMs = revealDurationMs(normalHand)
    expect(normalMs).toBeLessThan(6000)

    const withEvolvedMs = revealDurationMs([...normalHand, evolvedCard])
    expect(withEvolvedMs).toBeGreaterThan(normalMs)

    expect(revealDurationMs([])).toBe(THEME.timings.backdropFadeMs + THEME.timings.fadeOutMs)
  })

  it('reflects changes to tier hesitationMs in a copied theme', () => {
    const hand = [newCard, evolvedCard]
    const baseMs = revealDurationMs(hand)

    const customTheme: MomentTheme = structuredClone(THEME)
    const evolvedTier = customTheme.tiers.find((t) => t.id === 'evolved')!
    evolvedTier.hesitationMs += 750

    expect(revealDurationMs(hand, false, customTheme)).toBe(baseMs + 750)
  })

  it('revealEstimateMs picks the longest hand across characters', () => {
    const shortHand = [newCard]
    const longHand = [newCard, deepenedCard, evolvedCard]
    const payload = makePayload({
      a: shortHand,
      b: longHand,
      c: [newCard, newCard],
    })

    expect(revealEstimateMs(payload)).toBe(revealDurationMs(longHand))
  })
})

describe('revealAssets', () => {
  it('deduplicates sounds and images and includes accent sound for Thils cards', () => {
    const newOne = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
    const newTwo = cardFromOffer({ kind: 'boon', boonId: 'fleet-foot', source: 'weighted' }, emptySlots(3))
    const thilsCard = cardFromOffer({ kind: 'boon', boonId: 'thilss-favor', source: 'weighted' }, emptySlots(3))
    const payload = makePayload({ c1: [newOne, newTwo, thilsCard] })

    const assets = revealAssets(payload, ['c1'])
    expect(new Set(assets.sounds).size).toBe(assets.sounds.length)
    expect(new Set(assets.images).size).toBe(assets.images.length)
    expect(assets.sounds).toEqual(['dim', 'deal', 'flipNew', 'accentThils'])

    expect(revealAssets(payload, ['unknown'])).toEqual({ sounds: [], images: [] })
  })
})

describe('describeReveal', () => {
  it('formats DM indicator lines for draft, party-wide hidden, and forge reveals', () => {
    const newCard = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
    const evolvedCard = cardFromOffer(
      { kind: 'evolution', evolutionId: 'ball-of-yarn', slotIndex: 0, source: 'wildcard' },
      emptySlots(3),
    )

    expect(
      describeReveal(makePayload({ p1: [newCard], p2: [newCard], p3: [newCard] }), {}),
    ).toBe('Boon reveal for 3 players')

    expect(
      describeReveal(
        {
          kind: 'hidden',
          offers: { p1: [newCard], p2: [newCard], p3: [newCard] },
          names: {},
          conditionText: 'Defeat the warden before round 3',
          partyWide: true,
        },
        {},
      ),
    ).toBe('Secret condition met: hidden offers for 3 players')

    expect(
      describeReveal(
        {
          kind: 'forge',
          offers: { wiz: [newCard, evolvedCard] },
          names: {},
          conditionText: null,
          partyWide: false,
        },
        { wiz: 'Test Wizard' },
      ),
    ).toBe('Forge: Evolved for Test Wizard')
  })
})

describe('sample reveal builders', () => {
  const validTierIds = new Set(THEME.tiers.map((t) => t.id))

  it('sampleRevealAllTiers has no undefined values, valid tiers, and covers all five tiers', () => {
    const sample = sampleRevealAllTiers({
      characterIds: ['c1', 'c2'],
      names: { c1: 'Aeliana', c2: 'Bram' },
    })

    expect(findUndefinedPaths(sample)).toEqual([])
    expect(sample.type).toBe('boonReveal')
    expect(sample.audience).toEqual({ players: 'all', table: true })
    expect(sample.payload.offers.c1).toEqual(sample.payload.offers.c2)

    const tiers = sample.payload.offers.c1.map((card) => card.tier)
    for (const tier of tiers) {
      expect(validTierIds.has(tier)).toBe(true)
    }
    expect(new Set(tiers)).toEqual(validTierIds)
  })

  it('sampleRevealThils has no undefined values, valid tiers, thils accent on all three cards, and handles empty ctx', () => {
    const sample = sampleRevealThils({
      characterIds: [],
      names: {},
    })

    expect(findUndefinedPaths(sample)).toEqual([])
    expect(sample.type).toBe('boonReveal')
    expect(sample.audience).toEqual({ players: 'all', table: true })
    expect(Object.keys(sample.payload.offers)).toEqual(['sample'])

    const cards = sample.payload.offers.sample
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      expect(validTierIds.has(card.tier)).toBe(true)
      expect(card.accent).toBe('thils')
    }
  })
})
