import { describe, expect, it } from 'vitest'
import { buildOf, emptyProfile, type CharacterProfile } from '../model/character'
import {
  armorBase,
  buildSummary,
  mainClassId,
  masteryOptions,
  masteryPicks,
  tagWeights,
  trainedWithArmor,
  trainedWithWeapon,
  trainingOf,
  weaponBase,
} from './build'

const build = (overrides: Partial<CharacterProfile>): CharacterProfile => {
  const p = { ...emptyProfile(), ...overrides }
  return { ...p, ...buildOf({ ...p, ...overrides }) }
}
const weapon = (id: string) => weaponBase(id)!
const armor = (id: string) => armorBase(id)!

describe('training', () => {
  it('gives a class its full training', () => {
    const t = trainingOf(build({ classId: 'fighter', classLevel: 5 }))
    expect(trainedWithWeapon(t, weapon('greatsword'))).toBe(true)
    expect(trainedWithArmor(t, armor('plate'))).toBe(true)
    const wizard = trainingOf(build({ classId: 'wizard', classLevel: 5 }))
    expect(trainedWithWeapon(wizard, weapon('dagger'))).toBe(true)
    expect(trainedWithWeapon(wizard, weapon('longsword'))).toBe(false)
    expect(trainedWithArmor(wizard, armor('leather'))).toBe(false)
  })

  it('handles Monk (martial with Light) and Rogue (martial with Finesse or Light)', () => {
    const monk = trainingOf(build({ classId: 'monk', classLevel: 5 }))
    expect(trainedWithWeapon(monk, weapon('shortsword'))).toBe(true)
    expect(trainedWithWeapon(monk, weapon('rapier'))).toBe(false)
    const rogue = trainingOf(build({ classId: 'rogue', classLevel: 5 }))
    expect(trainedWithWeapon(rogue, weapon('rapier'))).toBe(true)
    expect(trainedWithWeapon(rogue, weapon('longsword'))).toBe(false)
  })

  it('adds only multiclass training from a second class, plus order, subclass and extra grants', () => {
    const wizFighter = trainingOf(build({ classId: 'wizard', classLevel: 5, secondClassId: 'fighter', secondClassLevel: 1 }))
    expect(trainedWithWeapon(wizFighter, weapon('longsword'))).toBe(true)
    expect(trainedWithArmor(wizFighter, armor('breastplate'))).toBe(true)
    expect(trainedWithArmor(wizFighter, armor('plate'))).toBe(false) // multiclass Fighter gives no heavy armor
    const protector = trainingOf(build({ classId: 'cleric', classLevel: 5, classOrders: { cleric: 'protector' } }))
    expect(trainedWithArmor(protector, armor('plate'))).toBe(true)
    const valor = (level: number) => trainingOf(build({ classId: 'bard', classLevel: level, subclass: 'Valor' }))
    expect(trainedWithArmor(valor(3), armor('shield'))).toBe(true)
    expect(trainedWithArmor(valor(2), armor('shield'))).toBe(false) // subclass not unlocked yet
    const feat = trainingOf(build({ classId: 'wizard', classLevel: 5, extraWeapons: ['rapier'], extraArmor: ['light'] }))
    expect(trainedWithWeapon(feat, weapon('rapier'))).toBe(true)
    expect(trainedWithArmor(feat, armor('leather'))).toBe(true)
  })
})

describe('Weapon Mastery', () => {
  it('uses the higher count of two mastery classes, by class level', () => {
    expect(masteryPicks(build({ classId: 'fighter', classLevel: 4 }))).toBe(4)
    expect(masteryPicks(build({ classId: 'wizard', classLevel: 5 }))).toBe(0)
    expect(masteryPicks(build({ classId: 'paladin', classLevel: 5, secondClassId: 'fighter', secondClassLevel: 4 }))).toBe(4)
  })

  it('only offers weapons the character is trained in', () => {
    const ids = masteryOptions(build({ classId: 'rogue', classLevel: 5 })).map((w) => w.id)
    expect(ids).toContain('rapier')
    expect(ids).not.toContain('greatsword')
  })
})

describe('multiclass tag weights', () => {
  it('Fighter 6 / Wizard 3: fighter map, plus Spell at x2', () => {
    const w = tagWeights(build({ classId: 'fighter', classLevel: 6, secondClassId: 'wizard', secondClassLevel: 3 }))
    expect(w).toMatchObject({ Crit: 3, Stance: 3, Echo: 3, Volley: 2, Hunt: 2, Flurry: 2, Spell: 2 })
    expect(w.Shadow).toBeUndefined() // wizard secondary tags add nothing
  })

  it('a one- or two-level dip adds nothing', () => {
    const w = tagWeights(build({ classId: 'fighter', classLevel: 6, secondClassId: 'wizard', secondClassLevel: 2 }))
    expect(w.Spell).toBeUndefined()
  })

  it('an exact tie uses both full maps', () => {
    const w = tagWeights(build({ classId: 'fighter', classLevel: 5, secondClassId: 'wizard', secondClassLevel: 5 }))
    expect(w).toMatchObject({ Crit: 3, Stance: 3, Echo: 3, Spell: 3, Volley: 2, Hunt: 2, Flurry: 2, Shadow: 2, Rally: 2 })
  })

  it('the class with more levels is the main class, even when it is the second one', () => {
    const b = build({ classId: 'wizard', classLevel: 2, secondClassId: 'fighter', secondClassLevel: 6 })
    expect(mainClassId(b)).toBe('fighter')
    expect(tagWeights(b).Crit).toBe(3)
    expect(tagWeights(b).Spell).toBeUndefined() // only 2 wizard levels
  })

  it('a homebrew class uses the player\'s own tags', () => {
    const w = tagWeights(build({ classId: 'homebrew', classLevel: 5, homebrewTags: { primary: ['Blood'], secondary: ['Shadow', 'Hunt'] } }))
    expect(w).toEqual({ Blood: 3, Shadow: 2, Hunt: 2 })
  })

  it('favored tags count as primary', () => {
    expect(tagWeights(build({ classId: 'ranger', classLevel: 5 }), ['Bond']).Bond).toBe(3)
  })
})

it('summarizes a build', () => {
  expect(buildSummary(build({ classId: 'fighter', classLevel: 6, subclass: 'Champion', secondClassId: 'wizard', secondClassLevel: 3, secondSubclass: 'Evoker' }))).toBe(
    'Fighter 6 (Champion) / Wizard 3 (Evoker)',
  )
})

describe('runs capture the build', () => {
  it('a run uses the main class for the hidden boon and the build\'s tag weights', async () => {
    const { draftProfileFor } = await import('./runFlow')
    const { emptyDungeonLayer } = await import('../model/character')
    const c = { ...build({ classId: 'wizard', classLevel: 2, secondClassId: 'fighter', secondClassLevel: 6, level: 8 }), ...emptyDungeonLayer(), id: 'x' }
    const profile = draftProfileFor(c)
    expect(profile.classId).toBe('fighter')
    expect(profile.tagWeights).toMatchObject({ Crit: 3 })
  })
})
