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
} from './upgrades'

const owner = (upgrades: Record<string, number>) => ({ upgrades })

describe('the upgrade table', () => {
  it('has all 13 upgrades from the bible', () => {
    expect(UPGRADES).toHaveLength(13)
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
