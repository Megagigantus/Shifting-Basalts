// Tests for portrait honors: glow tiers, full-clear diamonds, full-collection flag, and CSS classes.
import { describe, expect, it } from 'vitest'
import { echoPool, type Echoes } from './echoes'
import { honorClasses, NO_HONORS, portraitHonors } from './portraitHonors'

describe('portraitHonors', () => {
  it.each([
    [0, 0, 0],
    [1, 1, 0],
    [3, 3, 0],
    [5, 5, 0],
    [6, 5, 1],
    [8, 5, 3],
    [10, 5, 5],
    [14, 5, 5],
  ])('maps %i full clears to glowTier %i and %i diamonds', (fullClears, glowTier, diamonds) => {
    expect(portraitHonors({ fullClears })).toEqual({
      fullClears,
      glowTier,
      diamonds,
      fullCollection: false,
    })
  })

  it('treats missing, negative, or non-number fullClears as 0', () => {
    expect(portraitHonors(null)).toEqual(NO_HONORS)
    expect(portraitHonors(undefined)).toEqual(NO_HONORS)
    expect(portraitHonors({})).toEqual(NO_HONORS)
    expect(portraitHonors({ fullClears: -2 })).toEqual(NO_HONORS)
    expect(portraitHonors({ fullClears: Number.NaN })).toEqual(NO_HONORS)
    expect(portraitHonors({ fullClears: Number.POSITIVE_INFINITY })).toEqual(NO_HONORS)
    expect(portraitHonors({ fullClears: '4' as unknown as number })).toEqual(NO_HONORS)
  })

  it('sets fullCollection only when classId is set and every id in echoPool(c) is in echoes', () => {
    const pool = echoPool({ classId: 'fighter' })
    expect(portraitHonors({ classId: 'fighter', echoes: pool }).fullCollection).toBe(true)

    const missingBoon: Echoes = { ...pool, boons: pool.boons.slice(1) }
    expect(portraitHonors({ classId: 'fighter', echoes: missingBoon }).fullCollection).toBe(false)

    const missingHidden: Echoes = { ...pool, hidden: pool.hidden.slice(1) }
    expect(portraitHonors({ classId: 'fighter', echoes: missingHidden }).fullCollection).toBe(false)

    expect(portraitHonors({ echoes: pool }).fullCollection).toBe(false)
    expect(portraitHonors({ classId: '', echoes: pool }).fullCollection).toBe(false)

    const multiPool = echoPool({ classId: 'fighter', secondClassId: 'wizard' })
    expect(portraitHonors({ classId: 'fighter', secondClassId: 'wizard', echoes: pool }).fullCollection).toBe(false)
    expect(portraitHonors({ classId: 'fighter', secondClassId: 'wizard', echoes: multiPool }).fullCollection).toBe(true)
  })
})

describe('honorClasses', () => {
  it('returns empty string for no honors, and combines gold and green classes', () => {
    expect(honorClasses(NO_HONORS)).toBe('')
    expect(honorClasses({ fullClears: 3, glowTier: 3, diamonds: 0, fullCollection: false })).toBe('honor-ring honor-gold-3')
    expect(honorClasses({ fullClears: 0, glowTier: 0, diamonds: 0, fullCollection: true })).toBe('honor-ring honor-green')
    expect(honorClasses({ fullClears: 8, glowTier: 5, diamonds: 3, fullCollection: true })).toBe('honor-ring honor-gold-5 honor-green')
  })
})
