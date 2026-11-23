import { describe, expect, it } from 'vitest'
import { emptySlots, takeBoon } from '../rules/boons'
import { accentFor, cardFromHidden, cardFromOffer, revealOrder, tierFor, type RevealCard } from './revealTier'
import { checkTheme, THEME, type MomentTheme } from './theme'

function cloneTheme(): MomentTheme {
  return structuredClone(THEME)
}

describe('moment theme', () => {
  it('passes checkTheme on the shipped config', () => {
    expect(checkTheme(THEME)).toEqual([])
  })

  it('catches unknown tiers, missing presets, missing sounds and bad colors', () => {
    const unknownTier = cloneTheme()
    unknownTier.tierRules.push({ tier: 'mythic', when: {} })
    expect(checkTheme(unknownTier).some((p) => p.includes('mythic'))).toBe(true)

    const missingPreset = cloneTheme()
    missingPreset.tiers[0].particlePreset = 'nope'
    expect(checkTheme(missingPreset).some((p) => p.includes('nope'))).toBe(true)

    const missingSound = cloneTheme()
    missingSound.accents[0].soundKey = 'missingSound'
    expect(checkTheme(missingSound).some((p) => p.includes('missingSound'))).toBe(true)

    const badColor = cloneTheme()
    badColor.tiers[0].color = 'purple'
    expect(checkTheme(badColor).some((p) => p.includes('purple'))).toBe(true)

    const badPresetColor = cloneTheme()
    badPresetColor.particlePresets.softMotes.colors = ['#12345']
    expect(checkTheme(badPresetColor).some((p) => p.includes('#12345'))).toBe(true)
  })
})

describe('reveal tiers', () => {
  it('assigns each tier rule from real offer and hidden data', () => {
    const newCard = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3))
    expect(newCard).toEqual({
      cardKind: 'boon',
      id: 'hardy',
      offerType: 'new',
      fromLevel: null,
      toLevel: 1,
      conditionText: null,
      tier: 'new',
      accent: null,
    })

    const heldLevel2 = takeBoon(takeBoon(emptySlots(3), 'hardy'), 'hardy')
    const deepenedCard = cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'held' }, heldLevel2)
    expect(deepenedCard).toEqual({
      cardKind: 'boon',
      id: 'hardy',
      offerType: 'levelUp',
      fromLevel: 2,
      toLevel: 3,
      conditionText: null,
      tier: 'deepened',
      accent: null,
    })

    const evolvedCard = cardFromOffer(
      { kind: 'evolution', evolutionId: 'chain-of-echoes', slotIndex: 0, source: 'wildcard' },
      emptySlots(3),
    )
    expect(evolvedCard).toEqual({
      cardKind: 'evolution',
      id: 'chain-of-echoes',
      offerType: 'evolution',
      fromLevel: null,
      toLevel: null,
      conditionText: null,
      tier: 'evolved',
      accent: null,
    })

    const fusedCard = cardFromOffer({ kind: 'combination', combinationId: 'super-normal', source: 'wildcard' }, emptySlots(3))
    expect(fusedCard).toEqual({
      cardKind: 'combination',
      id: 'super-normal',
      offerType: 'combination',
      fromLevel: null,
      toLevel: null,
      sources: ['critical-delight', 'crits-are-for-suckers'],
      conditionText: null,
      tier: 'fused',
      accent: null,
    })

    const classHiddenCard = cardFromHidden('the-archivist', 'Keep three different spell effects active on enemies at once')
    expect(classHiddenCard).toEqual({
      cardKind: 'hidden',
      id: 'the-archivist',
      offerType: 'hidden',
      fromLevel: null,
      toLevel: null,
      conditionText: 'Keep three different spell effects active on enemies at once',
      tier: 'hidden',
      accent: null,
    })

    const giftHiddenCard = cardFromHidden('keeper-of-ways', null)
    expect(giftHiddenCard).toEqual({
      cardKind: 'hidden',
      id: 'keeper-of-ways',
      offerType: 'hidden',
      fromLevel: null,
      toLevel: null,
      conditionText: null,
      tier: 'hidden',
      accent: 'thils',
    })
  })

  it('applies the thils accent from data source without altering the tier', () => {
    const thilsBoon = cardFromOffer({ kind: 'boon', boonId: 'thilss-favor', source: 'weighted' }, emptySlots(3))
    expect(thilsBoon.tier).toBe('new')
    expect(thilsBoon.accent).toBe('thils')

    const thilsEvo = cardFromOffer(
      { kind: 'evolution', evolutionId: 'thilss-maze', slotIndex: 0, source: 'wildcard' },
      emptySlots(3),
    )
    expect(thilsEvo.tier).toBe('evolved')
    expect(thilsEvo.accent).toBe('thils')

    const normalBoon = cardFromOffer({ kind: 'boon', boonId: 'traverts-echoes', source: 'weighted' }, emptySlots(3))
    expect(normalBoon.accent).toBeNull()
  })

  it('drives tier and accent decisions from the theme config', () => {
    const custom = cloneTheme()
    custom.tierRules = custom.tierRules.map((rule) =>
      rule.tier === 'fused' ? { ...rule, tier: 'evolved' } : rule,
    )
    expect(tierFor({ offerType: 'combination' }, custom)).toBe('evolved')

    const noAccents = cloneTheme()
    noAccents.accentRules = []
    const thilsWithoutRule = cardFromOffer(
      { kind: 'boon', boonId: 'thilss-favor', source: 'weighted' },
      emptySlots(3),
      noAccents,
    )
    expect(thilsWithoutRule.accent).toBeNull()
    expect(accentFor({ offerType: 'new', source: 'thils' }, noAccents)).toBeNull()
  })

  it('sorts cards in ascending tier significance and keeps ties in original order', () => {
    const cards: RevealCard[] = [
      cardFromOffer({ kind: 'evolution', evolutionId: 'chain-of-echoes', slotIndex: 0, source: 'wildcard' }, emptySlots(3)),
      cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'weighted' }, emptySlots(3)),
      cardFromOffer({ kind: 'combination', combinationId: 'super-normal', source: 'wildcard' }, emptySlots(3)),
      cardFromOffer({ kind: 'boon', boonId: 'honed', source: 'held' }, takeBoon(emptySlots(3), 'honed')),
      cardFromOffer({ kind: 'boon', boonId: 'fleet-foot', source: 'wildcard' }, emptySlots(3)),
    ]

    const order = revealOrder(cards)
    expect(order).toEqual([1, 4, 3, 2, 0])
    expect(order.map((i) => cards[i].tier)).toEqual(['new', 'new', 'deepened', 'fused', 'evolved'])
    expect(cards[order[0]].id).toBe('hardy')
    expect(cards[order[1]].id).toBe('fleet-foot')
  })

  it('never emits undefined values on any reveal card', () => {
    const cards: RevealCard[] = [
      cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'starting' }, emptySlots(3)),
      cardFromOffer({ kind: 'boon', boonId: 'hardy', source: 'held' }, takeBoon(emptySlots(3), 'hardy')),
      cardFromOffer({ kind: 'evolution', evolutionId: 'thilss-maze', slotIndex: 0, source: 'wildcard' }, emptySlots(3)),
      cardFromOffer({ kind: 'combination', combinationId: 'super-normal', source: 'wildcard' }, emptySlots(3)),
      cardFromHidden('the-archivist', 'Keep three different spell effects active on enemies at once'),
      cardFromHidden('keeper-of-ways', null),
    ]

    for (const card of cards) {
      expect(Object.values(card)).not.toContain(undefined)
    }
  })
})
