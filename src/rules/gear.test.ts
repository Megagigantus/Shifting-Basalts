import { describe, expect, it } from 'vitest'
import type { RunState } from '../model/run'
import { ARMOR_BASES, WEAPON_BASES } from './build'
import { GEAR_ROWS, baseFields, baseOf, canUseBase, gearName, rollGear, untrainedNames, type RunTraining } from './gear'
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

describe('card rows', () => {
  it('match the bible\'s Columnbreaker and Sword of Apotheos examples', async () => {
    const { cardFields } = await import('./itemCard')
    const rows = (item: LootItem) => Object.fromEntries((cardFields(item) ?? []).map((f) => [f.label, f.value]))
    expect(rows(gear({ base: 'warhammer' }))).toMatchObject({ 'Rarity and value': 'Uncommon, 415 credits', Attunement: 'No', Mastery: expect.stringMatching(/^Push/) })
    const sword = rows({ uid: 'R', kind: 'relic', ref: 'sword-of-apotheos', rarity: null, relicState: 'dormant', floor: 5, room: 1, source: 'vault' })
    expect(sword).toMatchObject({
      Attunement: 'Required',
      'Attack and damage': '+2 to attack rolls; 1d8 + 2 slashing, or 1d10 + 2 two-handed',
      Mastery: expect.stringMatching(/^Sap/),
    })
    expect(sword.Property).toMatch(/^When an ally within 30 ft drops to 0 HP/)
    expect(sword['When Woken']).toMatch(/^Once per day, become Apotheos/)
  })
})

describe('full gear coverage (Gear d20)', () => {
  const ranger: RunTraining = { weapons: ['simple', 'martial'], armor: ['light', 'medium', 'shields'], masteries: [] }
  const monk: RunTraining = { weapons: ['simple', 'martial-light'], armor: [], masteries: [] }
  const rogue: RunTraining = { weapons: ['simple', 'martial-finesse-or-light'], armor: ['light'], masteries: [] }
  const bard: RunTraining = { weapons: ['simple'], armor: ['light'], masteries: [] }
  const ARMOR_ROWS = GEAR_ROWS.filter((r) => r.bases.some((b) => baseOf(b).armor)).map((r) => r.id)

  /** Every row and base this training rolled over many tries. */
  function rolled(training: RunTraining, n = 4000) {
    const random = seeded(11)
    const rows = new Set<string>()
    const bases = new Set<string>()
    for (let i = 0; i < n; i++) {
      const g = rollGear([{ characterId: 'x', training }], 'uncommon', random)
      rows.add(g.ref)
      bases.add(`${g.ref}:${g.base}`)
    }
    return { rows, bases }
  }

  it('has all 38 weapons and 13 armors, and every row base is real', () => {
    expect(WEAPON_BASES).toHaveLength(38)
    expect(ARMOR_BASES).toHaveLength(13)
    expect(GEAR_ROWS).toHaveLength(20)
    for (const r of GEAR_ROWS) for (const b of r.bases) expect(baseOf(b).weapon ?? baseOf(b).armor, `${r.id}: ${b}`).toBeDefined()
  })

  it('puts every base in at least one gear row', () => {
    for (const b of [...WEAPON_BASES, ...ARMOR_BASES]) expect(GEAR_ROWS.some((r) => r.bases.includes(b.id)), b.id).toBe(true)
  })

  it('lets a wizard roll rows 1, 2, 3, 5, 6 and 13, never armor', () => {
    const { rows } = rolled(wizard)
    for (const n of [1, 2, 3, 5, 6, 13]) expect(rows.has(GEAR_ROWS[n - 1].id), `row ${n}`).toBe(true)
    for (const id of ARMOR_ROWS) expect(rows.has(id), id).toBe(false)
  })

  it('lets a ranger roll a Bentshot bow as a shortbow or longbow', () => {
    const { bases } = rolled(ranger)
    expect(bases.has('bentshot-bow:shortbow')).toBe(true)
    expect(bases.has('bentshot-bow:longbow')).toBe(true)
  })

  it('lets a monk and a rogue roll a Lodge hush-piece as a hand crossbow, never a blowgun', () => {
    for (const t of [monk, rogue]) {
      const { bases } = rolled(t)
      expect(bases.has('lodge-hush-piece:hand-crossbow')).toBe(true)
      expect(bases.has('lodge-hush-piece:blowgun')).toBe(false)
    }
  })

  it('lets a fighter roll an Offering scale, but not a bard', () => {
    expect(rolled(fighter).rows.has('offering-scale')).toBe(true)
    expect(rolled(bard).rows.has('offering-scale')).toBe(false)
  })

  it('rolls the legendary second property from all 20 rows, never the first', () => {
    const random = seeded(13)
    const seconds = new Set<string>()
    for (let i = 0; i < 3000; i++) {
      const g = rollGear([{ characterId: 'f', training: fighter }], 'legendary', random)
      expect(g.secondRef).not.toBe(g.ref)
      seconds.add(g.secondRef!)
    }
    expect(seconds.size).toBe(20)
  })

  it('shows the Focus Spellcasting line only when there is a bonus', async () => {
    const { cardFields } = await import('./itemCard')
    const line = (rarity: LootItem['rarity']) => cardFields(gear({ ref: 'finders-staff', base: 'quarterstaff', rarity }))!.find((f) => f.label === 'Spellcasting')?.value
    expect(line('common')).toBeUndefined()
    expect(line('uncommon')).toBe('+1 to spell attacks and save DCs')
    expect(line('rare')).toBe('+2 to spell attacks and save DCs')
    expect(line('very-rare')).toBe('+3 to spell attacks and save DCs')
    expect(cardFields(gear({ ref: 'columnbreaker', base: 'warhammer', rarity: 'rare' }))!.some((f) => f.label === 'Spellcasting')).toBe(false)
  })

  it("matches the handoff's Finder's staff (quarterstaff) +2 example", async () => {
    const { cardFields } = await import('./itemCard')
    const item = gear({ ref: 'finders-staff', base: 'quarterstaff', rarity: 'rare' })
    expect(gearName(item)).toBe("Finder's staff (quarterstaff) +2")
    expect(itemValue(item)).toBe(4000)
    const f = Object.fromEntries(cardFields(item)!.map((x) => [x.label, x.value]))
    expect(f).toMatchObject({
      'Attack and damage': '+2 to attack rolls; 1d6 + 2 bludgeoning, or 1d8 + 2 two-handed',
      Properties: 'Versatile (1d8)',
      Mastery: expect.stringMatching(/^Topple/),
      Spellcasting: '+2 to spell attacks and save DCs',
    })
  })

  it('handles flat blowgun damage, ammunition notes and weapons with no properties', () => {
    expect(Object.fromEntries(baseFields('blowgun', 1).map((x) => [x.label, x.value]))['Attack and damage']).toBe(
      '+1 to attack rolls; 1 + 1 piercing (the bonus applies to the blowgun, not its needles)',
    )
    expect(Object.fromEntries(baseFields('longbow', 2).map((x) => [x.label, x.value]))['Attack and damage']).toMatch(/not its arrows\)$/)
    expect(Object.fromEntries(baseFields('blowgun', 0).map((x) => [x.label, x.value]))['Attack and damage']).toBe('1 piercing')
    expect(Object.fromEntries(baseFields('mace', 0).map((x) => [x.label, x.value])).Properties).toBe('None')
  })

  it('shows the new medium armors', () => {
    expect(Object.fromEntries(baseFields('half-plate', 1).map((x) => [x.label, x.value]))).toMatchObject({ Type: 'Medium armor', AC: '16 + Dex (max 2) (15 + 1)', Stealth: 'Disadvantage', Weight: '40 lb' })
  })
})
