import { describe, expect, it } from 'vitest'
import {
  costOfEverything,
  deepPocketsPercent,
  extraLootBonusPercent,
  extraPressuresBonusPercent,
  highestRank,
  maxRank,
  nextRankCost,
  ownedRankCost,
  ownerCount,
  quickReturnDays,
  shortenedLockout,
  UPGRADES,
  upgradesFor,
  lostAndFoundUses,
  reclaimCost,
} from './upgrades'

const owner = (upgrades: Record<string, number>) => ({ upgrades })

describe('the upgrade table', () => {
  it('has all 13 upgrades from the bible, plus the 2 full-clear rewards', () => {
    expect(UPGRADES).toHaveLength(15)
    expect(UPGRADES.filter((u) => u.requiresFullClear).map((u) => u.id)).toEqual(['lost-and-found', 'reclamation-shrine'])
  })

  it('shows full-clear upgrades only after a survived full clear', () => {
    expect(upgradesFor({}).some((u) => u.id === 'lost-and-found')).toBe(false)
    expect(upgradesFor({ fullClears: 0 })).toHaveLength(13)
    expect(upgradesFor({ fullClears: 1 })).toHaveLength(15)
  })

  it('prices Lost and Found uses and the Shrine', () => {
    expect([0, 1, 2, 3].map(lostAndFoundUses)).toEqual([0, 1, 1, 2])
    expect(reclaimCost(1, 1)).toBe(5)
    expect(reclaimCost(4, 1)).toBe(20)
    expect(reclaimCost(3, 2)).toBe(30)
  })

  it('prices ranks in order and stops at the max', () => {
    expect(maxRank('extra-boon-slot')).toBe(2)
    expect(nextRankCost('extra-boon-slot', 0)).toBe(40)
    expect(nextRankCost('extra-boon-slot', 1)).toBe(120)
    expect(nextRankCost('extra-boon-slot', 2)).toBeNull()
    expect(nextRankCost('reprieve', 3)).toBe(80)
    expect(ownedRankCost('reroll', 2)).toBe(20)
    expect(ownedRankCost('reroll', 0)).toBeNull()
  })

  it('costs about 1,000 Quantum Basalts to buy everything', () => {
    const total = costOfEverything()
    expect(total).toBeGreaterThan(900)
    expect(total).toBeLessThan(1100)
  })
})

describe('party effects', () => {
  const party = [
    owner({ 'extra-pressures': 2, 'deep-pockets': 1 }),
    owner({ 'extra-pressures': 1, 'deep-pockets': 3 }),
    owner({}),
  ]

  it('counts owners and highest ranks', () => {
    expect(ownerCount(party, 'extra-pressures')).toBe(2)
    expect(highestRank(party, 'extra-pressures')).toBe(2)
    expect(highestRank([], 'forge')).toBe(0)
  })

  it('every Extra Pressures owner adds 5%, the first included', () => {
    expect(extraPressuresBonusPercent(party)).toBe(10)
    expect(extraPressuresBonusPercent([owner({})])).toBe(0)
  })

  it('Deep Pockets uses the highest rank in the party', () => {
    expect(deepPocketsPercent(party)).toBe(15)
  })
})

describe('personal effects', () => {
  it('Extra Loot adds 10% per rank', () => {
    expect(extraLootBonusPercent(owner({ 'extra-loot': 3 }))).toBe(30)
  })

  it('Quick Return shortens lockouts but never below 1 day', () => {
    expect(quickReturnDays(owner({ 'quick-return': 2 }))).toBe(2)
    expect(shortenedLockout(7, 2)).toBe(5)
    expect(shortenedLockout(2, 3)).toBe(1)
  })
})

describe('the Healing Font', () => {
  it('needs a living owner, and adds 5 temp HP per owner beyond the first', async () => {
    const { healingFont } = await import('./upgrades')
    expect(healingFont([{ alive: true }, { alive: true, healingFontOwner: false }])).toBeNull()
    expect(healingFont([{ alive: false, healingFontOwner: true }])).toBeNull()
    expect(healingFont([{ alive: true, healingFontOwner: true }])).toEqual({ owners: 1, tempHp: 0 })
    expect(healingFont([1, 2, 3].map(() => ({ alive: true, healingFontOwner: true })))).toEqual({ owners: 3, tempHp: 10 })
  })
})
