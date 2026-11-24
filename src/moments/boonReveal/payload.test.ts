import { describe, expect, it } from 'vitest'
import { emptySlots } from '../../rules/boons'
import { cardFromHidden, cardFromOffer, type RevealCard } from '../revealTier'
import { THEME, tierById, type MomentTheme } from '../theme'
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
  spotlightCards,
  tableAssets,
  tableDurationMs,
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
      label: 'Combination',
      detail: 'Critical Delight + Crits Are for Suckers',
    })

    const evolvedCard = cardFromOffer(
      { kind: 'evolution', evolutionId: 'ball-of-yarn', slotIndex: 0, source: 'wildcard' },
      [{ kind: 'boon', boonId: 'ulmas-thread', level: 3 }, null, null],
    )
    expect(cardText(evolvedCard)).toEqual({
      name: 'Ball of Yarn',
      label: 'Evolution',
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
    ).toBe('Forge: Evolution for Test Wizard')
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

describe('spotlightCards', () => {
  it('returns only hidden, fused, and evolved cards in ascending tierRank order with names on the all-tiers sample', () => {
    const sample = sampleRevealAllTiers({
      characterIds: ['c1', 'c2'],
      names: { c1: 'Aeliana', c2: 'Bram' },
    })

    const spotlights = spotlightCards(sample.payload)
    expect(spotlights.map((s) => `${s.characterId}:${s.name}:${s.card.tier}`)).toEqual([
      'c1:Aeliana:hidden',
      'c2:Bram:hidden',
      'c1:Aeliana:fused',
      'c2:Bram:fused',
      'c1:Aeliana:evolved',
      'c2:Bram:evolved',
    ])
  })

  it('respects theme spotlight flags and falls back to "A player" when a name is missing', () => {
    const newCard = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
    const evolvedCard = cardFromOffer(
      { kind: 'evolution', evolutionId: 'ball-of-yarn', slotIndex: 0, source: 'wildcard' },
      emptySlots(3),
    )
    const payload = makePayload({ c1: [newCard, evolvedCard] })

    const newSpotlightTheme: MomentTheme = structuredClone(THEME)
    tierById('new', newSpotlightTheme).spotlight = true
    expect(spotlightCards(payload, newSpotlightTheme)).toEqual([
      { characterId: 'c1', name: 'A player', card: newCard },
      { characterId: 'c1', name: 'A player', card: evolvedCard },
    ])

    const noneSpotlightTheme: MomentTheme = structuredClone(THEME)
    for (const tier of noneSpotlightTheme.tiers) {
      tier.spotlight = false
    }
    expect(spotlightCards(payload, noneSpotlightTheme)).toEqual([])
  })

  it('returns an empty list when partyWide is true', () => {
    const hiddenCard = cardFromHidden('unbroken', 'Hit with every attack you made in a room.')
    const payload: BoonRevealPayload = {
      kind: 'hidden',
      offers: { c1: [hiddenCard], c2: [hiddenCard] },
      names: { c1: 'Aeliana', c2: 'Bram' },
      conditionText: 'Hit with every attack you made in a room.',
      partyWide: true,
    }

    expect(spotlightCards(payload)).toEqual([])
  })
})

describe('tableDurationMs and table revealEstimateMs', () => {
  const newCard = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
  const fusedCard = cardFromOffer(
    { kind: 'combination', combinationId: 'super-normal', source: 'wildcard' },
    emptySlots(3),
  )
  const evolvedCard = cardFromOffer(
    { kind: 'evolution', evolutionId: 'ball-of-yarn', slotIndex: 0, source: 'wildcard' },
    emptySlots(3),
  )
  const hiddenCard = cardFromHidden('unbroken', 'Hit with every attack you made in a room.')

  it('computes partyWide duration, spotlight sum duration, and 0 when nothing is shown', () => {
    const { backdropFadeMs, flipMs, spotlightHoldMs, fadeOutMs } = THEME.timings

    const nothingPayload = makePayload({ c1: [newCard] })
    expect(tableDurationMs(nothingPayload)).toBe(0)
    expect(tableDurationMs(makePayload({}))).toBe(0)

    const spotlightPayload = makePayload({ c1: [newCard, evolvedCard], c2: [fusedCard] })
    const expectedSpotlightMs =
      backdropFadeMs +
      (tierById('fused').hesitationMs + flipMs + spotlightHoldMs) +
      (tierById('evolved').hesitationMs + flipMs + spotlightHoldMs) +
      fadeOutMs
    expect(tableDurationMs(spotlightPayload)).toBe(expectedSpotlightMs)

    const partyPayload: BoonRevealPayload = {
      kind: 'hidden',
      offers: { c1: [hiddenCard], c2: [hiddenCard] },
      names: { c1: 'Aeliana', c2: 'Bram' },
      conditionText: 'Hit with every attack you made in a room.',
      partyWide: true,
    }
    const expectedPartyMs =
      backdropFadeMs + tierById('hidden').hesitationMs + flipMs + spotlightHoldMs + fadeOutMs
    expect(tableDurationMs(partyPayload)).toBe(expectedPartyMs)

    const emptyOffersPartyPayload: BoonRevealPayload = {
      ...partyPayload,
      offers: {},
    }
    expect(tableDurationMs(emptyOffersPartyPayload)).toBe(expectedPartyMs)

    const noHiddenTierTheme: MomentTheme = structuredClone(THEME)
    noHiddenTierTheme.tiers = noHiddenTierTheme.tiers.filter((t) => t.id !== 'hidden')
    expect(tableDurationMs(emptyOffersPartyPayload, noHiddenTierTheme)).toBe(
      backdropFadeMs + flipMs + spotlightHoldMs + fadeOutMs,
    )
  })

  it('revealEstimateMs is at least tableDurationMs when 4 characters each hold an evolved card', () => {
    const payload = makePayload(
      {
        c1: [evolvedCard],
        c2: [evolvedCard],
        c3: [evolvedCard],
        c4: [evolvedCard],
      },
      { c1: 'Aeliana', c2: 'Bram', c3: 'Corvus', c4: 'Dara' },
    )

    const tableMs = tableDurationMs(payload)
    expect(revealEstimateMs(payload)).toBeGreaterThanOrEqual(tableMs)
    expect(revealEstimateMs(payload)).toBe(tableMs)
  })
})

describe('tableAssets', () => {
  it('includes conditionMet only for partyWide and deduplicates sounds and images', () => {
    const newCard = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
    const fusedCard = cardFromOffer(
      { kind: 'combination', combinationId: 'super-normal', source: 'wildcard' },
      emptySlots(3),
    )
    const thilsHiddenCard = cardFromHidden('thilss-wink', 'An enemy was killed by terrain.')

    expect(tableAssets(makePayload({ c1: [newCard] }))).toEqual({ sounds: [], images: [] })

    const spotlightPayload = makePayload({
      c1: [fusedCard, thilsHiddenCard],
      c2: [fusedCard, thilsHiddenCard],
    })
    const spotlightAssets = tableAssets(spotlightPayload)
    expect(new Set(spotlightAssets.sounds).size).toBe(spotlightAssets.sounds.length)
    expect(new Set(spotlightAssets.images).size).toBe(spotlightAssets.images.length)
    expect(spotlightAssets.sounds).toEqual(['dim', 'flipHidden', 'accentThils', 'flipFused'])
    expect(spotlightAssets.sounds).not.toContain('conditionMet')

    const partyPayload: BoonRevealPayload = {
      kind: 'hidden',
      offers: { c1: [thilsHiddenCard], c2: [thilsHiddenCard] },
      names: { c1: 'Aeliana', c2: 'Bram' },
      conditionText: 'An enemy was killed by terrain.',
      partyWide: true,
    }
    const partyAssets = tableAssets(partyPayload)
    expect(new Set(partyAssets.sounds).size).toBe(partyAssets.sounds.length)
    expect(partyAssets.sounds).toEqual(['dim', 'conditionMet'])
    expect(partyAssets.images).toEqual([])
  })
})
