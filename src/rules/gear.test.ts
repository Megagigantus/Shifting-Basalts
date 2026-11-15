import { describe, expect, it } from 'vitest'
import type { RunState } from '../model/run'
import { baseFields, canUseBase, gearName, rollGear, untrainedNames, type RunTraining } from './gear'
import { gearBaseChoices, itemValue, reaimGear, setGearBase, type LootItem } from './loot'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const wizard: RunTraining = { weapons: ['simple'], armor: [], masteries: [] }
const fighter: RunTraining = { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'heavy', 'shields'], masteries: ['warhammer'] }
const players = [
  { characterId: 'w', name: 'Wren', training: wizard },
  { characterId: 'f', name: 'Fenn', training: fighter },
]
const gear = (extra: Partial<LootItem>): LootItem => ({ uid: 'G', kind: 'gear', ref: 'columnbreaker', rarity: 'uncommon', floor: 1, room: 1, source: 'room', ...extra })

describe('who gear drops for', () => {
  it('only rolls bases the aimed character is trained in', () => {
    const random = seeded(3)
    for (let i = 0; i < 300; i++) {
      const g = rollGear(players, 'uncommon', random, 'w')
      expect(g.forCharacterId).toBe('w')
      expect(canUseBase(wizard, g.base)).toBe(true) // never armor, never a martial weapon
    }
  })

  it('aims at a random character in the run when none is named', () => {
    const random = seeded(5)
    const aimed = new Set(Array.from({ length: 50 }, () => rollGear(players, 'rare', random).forCharacterId))
    expect(aimed).toEqual(new Set(['w', 'f']))
  })

  it('weighs mastery bases x2', () => {
    const random = seeded(7)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 6000; i++) {
      const g = rollGear(players, 'common', random, 'f')
      if (g.ref === 'columnbreaker') counts[g.base] = (counts[g.base] ?? 0) + 1
    }
    // light hammer : warhammer (mastery) : maul = 1 : 2 : 1
    expect(counts.warhammer / counts.maul).toBeGreaterThan(1.6)
    expect(counts.warhammer / counts['light-hammer']).toBeGreaterThan(1.6)
  })

  it('gives legendary gear a second property, and rolls freely when training is unknown', () => {
    const g = rollGear([{ characterId: 'x' }], 'legendary', seeded(2))
    expect(g.secondRef).toBeDefined()
    expect(g.secondRef).not.toBe(g.ref)
  })

  it('flags players who are not trained for the base', () => {
    expect(untrainedNames('plate', players)).toEqual(['Wren'])
    expect(untrainedNames('dagger', players)).toEqual([])
  })
})

describe('gear cards', () => {
  it('names gear "Item (base) +bonus" and values it at rarity plus base cost', () => {
    expect(gearName(gear({ base: 'warhammer' }))).toBe('Columnbreaker (warhammer) +1')
    expect(itemValue(gear({ base: 'warhammer' }))).toBe(415)
    expect(itemValue(gear({ ref: 'wardstone-plate', base: 'splint', rarity: 'rare' }))).toBe(4200)
    expect(gearName(gear({ rarity: 'common', base: 'maul' }))).toBe('Columnbreaker (maul)')
  })

  it('shows weapon stats with the bonus applied', () => {
    const f = Object.fromEntries(baseFields('warhammer', 1).map((x) => [x.label, x.value]))
    expect(f.Type).toBe('Martial melee weapon')
    expect(f['Attack and damage']).toBe('+1 to attack rolls; 1d8 + 1 bludgeoning, or 1d10 + 1 two-handed')
    expect(f.Mastery).toMatch(/^Push/)
  })

  it('shows armor stats with the bonus applied', () => {
    const f = Object.fromEntries(baseFields('splint', 2).map((x) => [x.label, x.value]))
    expect(f).toMatchObject({ Type: 'Heavy armor', AC: '19 (17 + 2)', Strength: '15, or speed drops by 10 ft', Stealth: 'Disadvantage', Weight: '60 lb' })
  })
})

describe('DM override', () => {
  const state = {
    run: { loot: { items: [gear({ base: 'warhammer', forCharacterId: 'f' })], credits: 0, nextUid: 2, log: [], searched: [] } },
    players,
  } as unknown as RunState

  it('picks a base from the row, and says which the aimed character can use', () => {
    expect(setGearBase(state, 'G', 'maul').run.loot!.items[0].base).toBe('maul')
    expect(() => setGearBase(state, 'G', 'plate')).toThrow()
    const reaimed = { ...state, run: { ...state.run, loot: { ...state.run.loot!, items: [gear({ base: 'warhammer', forCharacterId: 'w' })] } } }
    expect(gearBaseChoices(reaimed, reaimed.run.loot!.items[0])).toEqual([
      { id: 'light-hammer', usable: true },
      { id: 'warhammer', usable: false },
      { id: 'maul', usable: false },
    ])
  })

  it('re-aims a drop at another character with a base they can use', () => {
    const next = reaimGear(state, 'G', 'w', seeded(4)).run.loot!.items[0]
    expect(next).toMatchObject({ uid: 'G', rarity: 'uncommon', forCharacterId: 'w' })
    expect(canUseBase(wizard, next.base!)).toBe(true)
  })
})
