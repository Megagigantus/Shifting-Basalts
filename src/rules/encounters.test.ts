import { describe, expect, it } from 'vitest'
import boonData from '../data/boons.json'
import {
  benchmark,
  creatureOf,
  creatureStats,
  creatureXp,
  encounterBudget,
  encounterLevel,
  encounterView,
  familyWeights,
  generateEncounter,
  pushedStats,
} from './encounters'

// mulberry32: neighbouring seeds give unrelated sequences, unlike a plain LCG.
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const count = (e: ReturnType<typeof generateEncounter>) => e.groups.reduce((s, g) => s + g.count, 0)

describe('encounter budgets', () => {
  it('add up each player\'s own budget at their level plus the floor offset', () => {
    expect(encounterBudget([10, 10, 10, 10], 3)).toBe(4 * 3100) // level 10, High
    expect(encounterBudget([5, 5, 5, 5], 1)).toBe(4 * 225) // level 3, Moderate
    expect(encounterBudget([5, 9], 2)).toBe(500 + 2100) // levels 4 and 8, High
  })

  it('never go below level 1 or above level 22', () => {
    expect(encounterLevel(1, 1)).toBe(1)
    expect(encounterLevel(20, 4)).toBe(22)
  })
})

describe('family odds', () => {
  it('lean floor 3 toward Gate-Born and Echoes three to one', () => {
    const weights = Object.fromEntries(familyWeights(3).map((f) => [f.id, f.weight]))
    expect(weights).toEqual({ wardstones: 1, mazework: 1, 'the-lost': 1, 'absorbed-echoes': 3, 'gate-born': 3 })
    expect(familyWeights(1).map((f) => f.id)).toEqual(['wardstones', 'mazework'])
  })
})

describe('generating encounters', () => {
  const cases = [
    { floor: 1, levels: [5, 5, 5, 5] },
    { floor: 2, levels: [8, 8, 9] },
    { floor: 3, levels: [12, 12, 12, 12, 12] },
    { floor: 4, levels: [17, 18, 17, 17] },
    { floor: 4, levels: [20, 20, 20, 20, 20, 20] },
  ]

  it('stay inside the budget, the creature cap and the CR cap, using the floor\'s families', () => {
    for (const { floor, levels } of cases) {
      const partyLevel = Math.floor(levels.reduce((a, b) => a + b) / levels.length)
      const allowed = familyWeights(floor).map((f) => f.id)
      for (let seed = 1; seed <= 150; seed++) {
        const e = generateEncounter(floor, false, levels, partyLevel, seeded(seed))
        expect(e.xp).toBeLessThanOrEqual(e.budget)
        expect(count(e)).toBeLessThanOrEqual(levels.length * 2)
        for (const g of e.groups) {
          expect(g.cr).toBeLessThanOrEqual(e.maxCr)
          expect(allowed).toContain(creatureOf(g.creatureId).family)
          expect(g.revealed).toBe(false)
        }
      }
    }
  })

  it('use most of the budget, pushing CRs when the roster runs short', () => {
    for (const { floor, levels } of cases) {
      const partyLevel = Math.floor(levels.reduce((a, b) => a + b) / levels.length)
      let used = 0
      for (let seed = 1; seed <= 100; seed++) {
        const e = generateEncounter(floor, false, levels, partyLevel, seeded(seed))
        used += e.xp / e.budget
      }
      expect(used / 100).toBeGreaterThan(0.75)
    }
  })

  it('pushes creatures with benchmark offence, scaled HP and their own AC', () => {
    const pushed = { creatureId: 'hexling', cr: 6, count: 1, revealed: false }
    // HP: CR 6 benchmark 153 x Hexling hpMult 0.42 = 64. AC stays the Hexling's 18.
    expect(pushedStats(pushed)).toMatchObject({ cr: 6, ac: 18, hp: 64, attack: 6, dpr: 42, dc: 15 })
    expect(pushedStats({ ...pushed, cr: 1 })).toBeNull()
  })

  it('uses Monster Manual stats at base CR and raises saves by PB when pushed', () => {
    expect(creatureStats({ creatureId: 'hexling', cr: 1 })).toMatchObject({ ac: 18, hp: 33, saves: { str: 2, wis: -4 } })
    // CR 1 PB 2 -> CR 6 PB 3: every save +1.
    expect(creatureStats({ creatureId: 'hexling', cr: 6 }).saves).toEqual({ str: 3, dex: 1, con: 2, int: -4, wis: -3, cha: -4 })
  })

  it('has a CR 1/2 benchmark row', () => {
    expect(benchmark(0.5)).toMatchObject({ cr: 0.5, hp: 60, pb: 2 })
    expect(benchmark(1)).toMatchObject({ cr: 1, hp: 78 })
  })

  it('gives every Absorbed Echo a Level 1 or 2 boon, never a Payoff', () => {
    let echoes = 0
    for (let seed = 1; seed <= 200; seed++) {
      const e = generateEncounter(3, false, [10, 10, 10, 10], 10, seeded(seed))
      for (const g of e.groups) {
        if (creatureOf(g.creatureId).family !== 'absorbed-echoes') {
          expect(g.boons).toBeUndefined()
          continue
        }
        echoes++
        expect(g.boons).toHaveLength(g.count)
        for (const b of g.boons!) {
          expect([1, 2]).toContain(b.level)
          expect(boonData.find((x) => x.id === b.id)?.kind).not.toBe('payoff')
        }
      }
    }
    expect(echoes).toBeGreaterThan(20)
  })

  it('adds the elite extra on top of the budget', () => {
    const kinds = new Set<string>()
    for (let seed = 1; seed <= 100; seed++) {
      const e = generateEncounter(2, true, [8, 8, 8, 8], 8, seeded(seed))
      kinds.add(e.elite!)
      expect(e.groups.some((g) => g.source === 'elite')).toBe(true)
      const total = e.groups.reduce((s, g) => s + creatureXp(g.cr) * g.count, 0)
      expect(total).toBeGreaterThan(e.xp)
    }
    expect(kinds).toEqual(new Set(['next-floor', 'push']))
  })

  it('always pushes on floor 4, where there is no next floor', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(generateEncounter(4, true, [12, 12, 12, 12], 12, seeded(seed)).elite).toBe('push')
    }
  })

  it('splashes a second family in about 1 room in 4', () => {
    let splashes = 0
    for (let seed = 1; seed <= 400; seed++) {
      const e = generateEncounter(2, false, [8, 8, 8, 8], 8, seeded(seed))
      if (e.splashFamily) {
        splashes++
        expect(e.splashFamily).not.toBe(e.family)
        expect(e.groups.some((g) => g.source === 'splash')).toBe(true)
      }
    }
    expect(splashes).toBeGreaterThan(60)
    expect(splashes).toBeLessThan(140)
  })
})

describe('the player view of an encounter', () => {
  it('shows revealed creatures by name and count only', () => {
    const e = generateEncounter(1, false, [5, 5, 5, 5], 5, seeded(3))
    expect(encounterView(e)).toEqual([])
    e.groups[0].revealed = true
    expect(encounterView(e)).toEqual([{ creatureId: e.groups[0].creatureId, count: e.groups[0].count }])
  })
})
