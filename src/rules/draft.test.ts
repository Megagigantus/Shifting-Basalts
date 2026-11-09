import { describe, expect, it } from 'vitest'
import { emptySlots, takeBoon, type Slot } from './boons'
import {
  boonWeight,
  canUse,
  classHiddenBoon,
  eligibleBoons,
  generateOffer,
  giftOffer,
  slotPlan,
  weightedPick,
  type DraftCharacter,
  type Offer,
} from './draft'
import { BOONS, boon } from './boons'

/** A repeatable pseudo-random source, so test runs are stable. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const wizard: DraftCharacter = { classId: 'wizard', casterType: 'full', hasSummon: false, trackDevotions: {} }
const fighter: DraftCharacter = { classId: 'fighter', casterType: 'none', hasSummon: false, trackDevotions: {} }
const toLevel3 = (slots: Slot[], id: string) => takeBoon(takeBoon(takeBoon(slots, id), id), id)
const boonIds = (offers: Offer[]) => offers.flatMap((o) => (o.kind === 'boon' ? [o.boonId] : []))

describe('eligibility', () => {
  it('keeps Spell boons, Quick Cantrip and Leyline Surge from non-casters', () => {
    expect(canUse(boon('conduit'), fighter)).toBe(false)
    expect(canUse(boon('quick-cantrip'), fighter)).toBe(false)
    expect(canUse(boon('conduit'), wizard)).toBe(true)
    expect(canUse(boon('quick-cantrip'), wizard)).toBe(true)
  })

  it('keeps Bond boons from characters without a summon', () => {
    expect(canUse(boon('pack-tactics'), wizard)).toBe(false)
    expect(canUse(boon('pack-tactics'), { ...wizard, hasSummon: true })).toBe(true)
  })

  it('offers a Payoff only with at least 1 rank in its track', () => {
    expect(canUse(boon('spillover'), wizard)).toBe(false)
    expect(canUse(boon('spillover'), { ...wizard, trackDevotions: { 'healing-received': 3 } })).toBe(true)
    // Leyline Surge also needs spells, even with a rank.
    expect(canUse(boon('leyline-surge'), { ...fighter, trackDevotions: { 'spell-slot-recovery': 3 } })).toBe(false)
  })

  it('drops banished and held boons', () => {
    const pool = eligibleBoons({ ...wizard, banished: ['hardy'] }, ['honed'])
    expect(pool.some((b) => b.id === 'hardy' || b.id === 'honed')).toBe(false)
  })
})

describe('weights', () => {
  it('multiply class primary x3, secondary x2 and held tag x2; Core stays 1', () => {
    const none = new Set<string>()
    expect(boonWeight(boon('conduit'), 'wizard', none)).toBe(3) // Spell: wizard primary
    expect(boonWeight(boon('fading-veil'), 'wizard', none)).toBe(2) // Shadow: wizard secondary
    expect(boonWeight(boon('hardened-hide'), 'wizard', none)).toBe(1) // Guard: neither
    expect(boonWeight(boon('conduit'), 'wizard', new Set(['Spell']))).toBe(6)
    expect(boonWeight(boon('hardy'), 'wizard', new Set(['Core']))).toBe(1)
  })

  it('favored tags count as primary for that character (a subclass shift)', () => {
    const none = new Set<string>()
    expect(boonWeight(boon('pack-tactics'), 'ranger', none)).toBe(2) // Bond: ranger secondary
    expect(boonWeight(boon('pack-tactics'), 'ranger', none, ['Bond'])).toBe(3)
    expect(boonWeight(boon('hardy'), 'ranger', none, ['Core'])).toBe(1) // Core stays 1
  })

  it('weighted picks follow the weights', () => {
    const random = seeded(7)
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 4000; i++) counts[weightedPick(['a', 'b'] as const, (x) => (x === 'a' ? 3 : 1), random)!]++
    expect(counts.a / 4000).toBeGreaterThan(0.7)
    expect(counts.a / 4000).toBeLessThan(0.8)
  })

  it('a Wizard sees mostly, but not only, Spell boons in weighted rolls', () => {
    const random = seeded(42)
    let spell = 0
    let total = 0
    for (let i = 0; i < 400; i++) {
      for (const o of generateOffer({ character: wizard, slots: emptySlots(3), offerSize: 4, random })) {
        if (o.kind === 'boon' && o.source === 'weighted') {
          total++
          if (boon(o.boonId).tags.includes('Spell')) spell++
        }
      }
    }
    expect(spell / total).toBeGreaterThan(0.3)
    expect(spell / total).toBeLessThan(0.65)
  })
})

describe('offer slots', () => {
  it('has 4 slots normally and fewer under Narrow Seam; Elite keeps the wildcard', () => {
    expect(slotPlan(4, false)).toEqual(['held', 'weighted', 'weighted', 'wildcard'])
    expect(slotPlan(3, false)).toEqual(['held', 'weighted', 'wildcard'])
    expect(slotPlan(2, false)).toEqual(['held', 'weighted'])
    expect(slotPlan(2, true)).toEqual(['held', 'wildcard'])
  })

  it('a fresh character gets 4 different, eligible boons', () => {
    const random = seeded(1)
    for (let i = 0; i < 200; i++) {
      const ids = boonIds(generateOffer({ character: fighter, slots: emptySlots(3), offerSize: 4, random }))
      expect(ids).toHaveLength(4)
      expect(new Set(ids).size).toBe(4)
      for (const id of ids) expect(canUse(boon(id), fighter)).toBe(true)
    }
  })

  it('never shows more than 2 boons of one tag', () => {
    const random = seeded(3)
    for (let i = 0; i < 300; i++) {
      const tags = boonIds(generateOffer({ character: wizard, slots: emptySlots(3), offerSize: 4, random })).map(
        (id) => boon(id).tags[0],
      )
      for (const t of new Set(tags)) expect(tags.filter((x) => x === t).length).toBeLessThanOrEqual(2)
    }
  })

  it('slot 1 offers a held boon below Level 3', () => {
    let slots = takeBoon(emptySlots(3), 'hardy')
    slots = toLevel3(slots, 'honed')
    const offers = generateOffer({ character: fighter, slots, offerSize: 4, random: seeded(5) })
    expect(offers[0]).toEqual({ kind: 'boon', boonId: 'hardy', source: 'held' })
    // Held boons never come up as new picks.
    expect(offers.slice(1).some((o) => o.kind === 'boon' && ['hardy', 'honed'].includes(o.boonId))).toBe(false)
  })

  it('slot 1 becomes a wildcard when every held boon is maxed', () => {
    const slots = toLevel3(emptySlots(3), 'traverts-echoes')
    const offers = generateOffer({ character: fighter, slots, offerSize: 4, random: seeded(9) })
    expect(offers[0]).toMatchObject({ kind: 'evolution', evolutionId: 'chain-of-echoes', slotIndex: 0 })
  })

  it('the wildcard offers the player\'s own Combination when they qualify', () => {
    let slots = toLevel3(emptySlots(3), 'critical-delight')
    slots = toLevel3(slots, 'crits-are-for-suckers')
    const random = seeded(11)
    for (let i = 0; i < 50; i++) {
      const offers = generateOffer({ character: fighter, slots, offerSize: 4, random })
      // Both held boons are maxed, so slot 1 is a wildcard too; the offer stays full and never repeats.
      expect(offers).toHaveLength(4)
      expect(offers.filter((o) => o.kind === 'combination' && o.combinationId === 'super-normal')).toHaveLength(1)
    }
  })

  it('Attunement puts the chosen tag in the first offer', () => {
    const random = seeded(13)
    for (let i = 0; i < 50; i++) {
      const offers = generateOffer({ character: fighter, slots: emptySlots(3), offerSize: 4, attuneTag: 'Guard', random })
      expect(boonIds(offers).some((id) => boon(id).tags[0] === 'Guard')).toBe(true)
    }
  })

  it('banished boons never appear, even as the wildcard', () => {
    const banished = BOONS.filter((b) => b.tags[0] === 'Core').map((b) => b.id).slice(0, 3)
    const random = seeded(17)
    for (let i = 0; i < 300; i++) {
      const ids = boonIds(generateOffer({ character: { ...fighter, banished }, slots: emptySlots(3), offerSize: 4, random }))
      for (const id of banished) expect(ids).not.toContain(id)
    }
  })
})

describe('hidden offers', () => {
  it('offers 2 different gifts the player doesn\'t hold', () => {
    const random = seeded(19)
    for (let i = 0; i < 100; i++) {
      const gifts = giftOffer('keeper-of-ways', random)
      expect(gifts).toHaveLength(2)
      expect(new Set(gifts).size).toBe(2)
      expect(gifts).not.toContain('keeper-of-ways')
    }
  })

  it('a class trigger offers that class\'s hidden boon', () => {
    expect(classHiddenBoon('wizard')).toBe('the-archivist')
    expect(classHiddenBoon('nobody')).toBeNull()
  })
})
