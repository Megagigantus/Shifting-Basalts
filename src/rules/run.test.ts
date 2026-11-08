import { describe, expect, it } from 'vitest'
import {
  availablePressures,
  bossQuantumBasalts,
  devotionsForRoom,
  entryMultiplier,
  lootKeptPercent,
  partyLevel,
  passQuantumBasalts,
  pressureBonusPercent,
  rollLockoutDays,
  togglePressure,
  withPressureBonus,
} from './run'
import { proficiencyBonus } from './proficiency'

describe('party level', () => {
  it('averages and rounds down', () => {
    expect(partyLevel([5, 6, 6, 8])).toBe(6) // 6.25
    expect(partyLevel([10, 11])).toBe(10) // 10.5
    expect(partyLevel([])).toBe(0)
  })
})

describe('entry multiplier', () => {
  it('follows the tiers of play', () => {
    expect(entryMultiplier(5)).toBe(1)
    expect(entryMultiplier(10)).toBe(1)
    expect(entryMultiplier(11)).toBe(2)
    expect(entryMultiplier(16)).toBe(2)
    expect(entryMultiplier(17)).toBe(4)
    expect(entryMultiplier(20)).toBe(4)
  })
})

describe('proficiency bonus', () => {
  it('matches the 5e table', () => {
    expect([5, 8, 9, 12, 13, 16, 17, 20].map(proficiencyBonus)).toEqual([3, 3, 4, 4, 5, 5, 6, 6])
  })
})

describe('pressures', () => {
  it('unlocks by Extra Pressures rank', () => {
    expect(availablePressures(0).map((p) => p.id)).toEqual([
      'brittle-ground',
      'narrow-seam',
      'closing-ring',
    ])
    expect(availablePressures(1)).toHaveLength(5)
    expect(availablePressures(2)).toHaveLength(10)
  })

  it('adds bonuses together', () => {
    expect(pressureBonusPercent([])).toBe(0)
    expect(pressureBonusPercent(['brittle-ground', 'closing-ring'])).toBe(25)
    expect(pressureBonusPercent(['heavy-crown-2', 'narrow-seam'])).toBe(45)
  })

  it('swaps a base version for its harsher version and back', () => {
    let picked = togglePressure([], 'closing-ring')
    picked = togglePressure(picked, 'narrow-seam')
    picked = togglePressure(picked, 'closing-ring-2')
    expect(picked).toEqual(['narrow-seam', 'closing-ring-2'])
    picked = togglePressure(picked, 'closing-ring')
    expect(picked).toEqual(['narrow-seam', 'closing-ring'])
    expect(togglePressure(picked, 'narrow-seam')).toEqual(['closing-ring'])
  })
})

describe('Quantum Basalts', () => {
  it('pays each boss times the entry multiplier', () => {
    expect([1, 2, 3, 4, 5].map((f) => bossQuantumBasalts(f, 1))).toEqual([5, 8, 12, 15, 25])
    expect(bossQuantumBasalts(5, 4)).toBe(100)
  })

  it('a full clear at tier 1 totals 65', () => {
    const total = [1, 2, 3, 4, 5].reduce((sum, f) => sum + bossQuantumBasalts(f, 1), 0)
    expect(total).toBe(65)
  })

  it('rounds Pressure bonuses up', () => {
    expect(withPressureBonus(13, 0)).toBe(13)
    expect(withPressureBonus(13, 10)).toBe(15) // 14.3 -> 15
    expect(withPressureBonus(40, 25)).toBe(50)
  })

  it('passes ignore Pressures and scale with the multiplier', () => {
    expect(passQuantumBasalts(1)).toBe(1)
    expect(passQuantumBasalts(4)).toBe(4)
  })
})

describe('loot kept', () => {
  it('rises with the last boss beaten', () => {
    expect([0, 1, 2, 3, 4, 5].map(lootKeptPercent)).toEqual([0, 25, 40, 60, 80, 100])
  })
})

describe('devotions', () => {
  it('pays per room type', () => {
    expect(devotionsForRoom('combat')).toBe(1)
    expect(devotionsForRoom('elite')).toBe(2)
    expect(devotionsForRoom('boss')).toBe(1)
    expect(devotionsForRoom('reprieve')).toBe(0)
  })
})

describe('death lockout', () => {
  it('rolls 1d4 per floor reached', () => {
    const result = rollLockoutDays(3, () => 2)
    expect(result).toEqual({ days: 6, rolls: [2, 2, 2] })
  })

  it('stays within 1 to 4 days per floor with real dice', () => {
    for (let i = 0; i < 200; i++) {
      const { days } = rollLockoutDays(2)
      expect(days).toBeGreaterThanOrEqual(2)
      expect(days).toBeLessThanOrEqual(8)
    }
  })
})
