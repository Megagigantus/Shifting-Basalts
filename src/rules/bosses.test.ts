import { describe, expect, it } from 'vitest'
import { BOSSES, bossesOnFloor, buildBoss, damageDice, floorBossDc, pickBoss, restlessShiftActions } from './bosses'

const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('the bible\'s worked example', () => {
  it('builds General Vane for a party of 4 at level 10 on floor 3', () => {
    const vane = buildBoss('general-vane', 10, 4, [])
    expect(vane).toMatchObject({ cr: 12, ac: 19, hp: 292, attack: 8, dc: 17 })
    expect(vane.attacks[0]).toMatchObject({ name: 'Halberd', count: 3, damage: { expression: '3d10 + 7', average: 23 } })
    expect(vane.legendaryActions).toBe(2)
    expect(vane.legendaryResistances).toBe(1)
  })
})

describe('boss scaling', () => {
  it('sets CR by floor and never below 1', () => {
    expect(buildBoss('tessellated-warden', 10, 4, []).cr).toBe(9)
    expect(buildBoss('ophaniel', 10, 4, []).cr).toBe(17)
    expect(buildBoss('tessellated-warden', 1, 4, []).cr).toBe(1)
  })

  it('multiplies HP by party size / 4 and adds a Legendary Action at 6 players', () => {
    const four = buildBoss('general-vane', 10, 4, [])
    const six = buildBoss('general-vane', 10, 6, [])
    expect(six.hp).toBe(Math.round(243 * 1.2 * 1.5))
    expect(six.legendaryActions).toBe(four.legendaryActions + 1)
    expect(buildBoss('general-vane', 10, 2, []).hp).toBe(Math.round(243 * 1.2 * 0.5))
  })

  it('Heavy Crown gives floor 1 bosses a Legendary Action with generic options', () => {
    const plain = buildBoss('tessellated-warden', 8, 4, [])
    expect(plain.legendaryActions).toBe(0)
    expect(plain.legendaryOptions).toEqual([])
    const crowned = buildBoss('tessellated-warden', 8, 4, ['heavy-crown'])
    expect(crowned.legendaryActions).toBe(1)
    expect(crowned.legendaryOptions.map((o) => o.name)).toEqual(['Attack', 'Move'])
  })

  it('Heavy Crown II adds a Legendary Action and a Legendary Resistance', () => {
    const boss = buildBoss('blind-architect', 10, 4, ['heavy-crown-2'])
    expect(boss.legendaryActions).toBe(3)
    expect(boss.legendaryResistances).toBe(3)
    expect(boss.legendaryOptions.map((o) => o.name)).toContain('Fold (costs 2)')
  })

  it('splits HP across parts, or shares one pool', () => {
    const herd = buildBoss('gilded-excavation-herd', 10, 4, []) // CR 9: AC 16, HP 198
    expect(herd.parts).toEqual([
      { name: 'Golem', count: 1, ac: 17, hp: 139 },
      { name: 'Hound', count: 2, ac: 15, hp: 30 },
    ])
    expect(herd.hp).toBe(139 + 60)
    const choir = buildBoss('choir-hollow-column', 10, 4, [])
    expect(choir.parts[0]).toMatchObject({ count: 4, hp: Math.round(Math.round(198 * 1.2) / 4) })
    const chorus = buildBoss('chorus-unseen-angles', 8, 4, []) // CR 12: AC 17
    expect(chorus.sharedHp).toBe(true)
    expect(chorus.parts[0]).toEqual({ name: 'Member', count: 3, ac: 18, hp: null })
  })

  it('fills every placeholder in every boss\'s text', () => {
    for (const b of BOSSES) {
      for (const level of [5, 12, 20]) {
        const built = buildBoss(b.id, level, 4, ['heavy-crown'])
        const texts = [
          ...built.attacks.map((a) => a.text),
          ...built.specials.map((s) => s.text),
          ...built.legendaryOptions.map((o) => o.text),
          built.shiftAction.text,
        ]
        for (const text of texts) expect(text).not.toMatch(/[{}]/)
        for (const a of built.attacks) expect(a.damage.average).toBeGreaterThan(0)
      }
    }
  })
})

describe('damage dice (bible: Damage dice)', () => {
  it('rolls 0.75 x target in dice, rounded down, with the rest as a flat bonus', () => {
    expect(damageDice(23.4, 'd10')).toEqual({ expression: '3d10 + 7', average: 23 })
    expect(damageDice(27.3, 'd12')).toEqual({ expression: '3d12 + 8', average: 27 })
    expect(damageDice(4, 'd6')).toEqual({ expression: '1d6 + 1', average: 4 })
  })

  it('always rolls at least one die, even when that leaves a negative bonus', () => {
    expect(damageDice(3, 'd10')).toEqual({ expression: '1d10 − 2', average: 3 })
  })

  it('uses each attack\'s die from the bible\'s table', () => {
    const die = (bossId: string, attack: string) =>
      buildBoss(bossId, 10, 4, []).attacks.find((a) => a.name === attack)!.damage.expression.match(/d\d+/)![0]
    expect(die('kaelen-and-vyr', 'Cleave')).toBe('d12')
    expect(die('halvard-quill', 'Longshot')).toBe('d8')
    expect(die('glass-hydra', 'Bite (light-head)')).toBe('d6')
    expect(die('sun-eaters-husk', 'Antler Rake')).toBe('d12')
    expect(die('gatewright', 'Portal Strike')).toBe('d10')
  })

  it('uses smaller dice for auras and area attacks', () => {
    const special = (bossId: string, name: string) =>
      buildBoss(bossId, 10, 4, []).specials.find((s) => s.name.startsWith(name))!.text
    expect(special('choir-hollow-column', 'Hymn Aura')).toMatch(/d6/)
    expect(special('sun-eaters-husk', 'Core Flare')).toMatch(/d8/)
  })

  it('the Glass Hydra starts with 3 heads', () => {
    expect(buildBoss('glass-hydra', 10, 4, []).specials[0].text).toMatch(/^Starts with 3 heads, one each for fire, lightning and cold\./)
  })
})

describe('picking bosses', () => {
  it('chooses one of the floor\'s three, and a reroll changes it', () => {
    const first = pickBoss(2, seq(0))
    expect(bossesOnFloor(2).map((b) => b.id)).toContain(first)
    expect(pickBoss(2, seq(0), first)).not.toBe(first)
  })

  it('Restless Stone uses the floor\'s other bosses\' Shift Actions', () => {
    expect(restlessShiftActions(1, 'tessellated-warden', 1, seq(0))).toEqual(['choir-hollow-column'])
    const two = restlessShiftActions(1, 'tessellated-warden', 2, seq(0.9))
    expect(new Set(two)).toEqual(new Set(['choir-hollow-column', 'gilded-excavation-herd']))
  })

  it('Shift Actions use the floor\'s boss save DC', () => {
    expect(floorBossDc(3, 10)).toBe(17)
  })
})
