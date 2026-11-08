import { describe, expect, it } from 'vitest'
import {
  costOfRank,
  devotionsForRank,
  effectAtRank,
  investmentCap,
  rankProgress,
  STAT_TRACKS,
  tierCap,
} from './statTracks'

const track = (id: string) => STAT_TRACKS.find((t) => t.id === id)!

describe('rank costs', () => {
  it('cost 3, then 5, then 8 Devotions per rank', () => {
    expect([1, 5, 6, 10, 11, 20].map(costOfRank)).toEqual([3, 3, 5, 5, 8, 8])
  })

  it('maxing a track takes 120 Devotions', () => {
    expect(devotionsForRank(5)).toBe(15)
    expect(devotionsForRank(10)).toBe(40)
    expect(devotionsForRank(20)).toBe(120)
  })
})

describe('rank progress', () => {
  it('turns invested Devotions into ranks with leftover progress', () => {
    expect(rankProgress(0)).toEqual({ rank: 0, towardNext: 0, nextCost: 3 })
    expect(rankProgress(2)).toEqual({ rank: 0, towardNext: 2, nextCost: 3 })
    expect(rankProgress(3)).toEqual({ rank: 1, towardNext: 0, nextCost: 3 })
    expect(rankProgress(17)).toEqual({ rank: 5, towardNext: 2, nextCost: 5 })
    expect(rankProgress(120)).toEqual({ rank: 20, towardNext: 0, nextCost: null })
  })
})

describe('tier caps', () => {
  it('rise with the tiers of play', () => {
    expect([5, 10, 11, 16, 17, 20].map(tierCap)).toEqual([5, 5, 10, 10, 20, 20])
    expect(investmentCap(7)).toBe(15)
    expect(investmentCap(12)).toBe(40)
    expect(investmentCap(18)).toBe(120)
  })
})

describe('effects', () => {
  it('show what the dungeon adds, as modifiers', () => {
    expect(effectAtRank(track('max-hp'), 3)).toBe('+6 max HP')
    expect(effectAtRank(track('speed'), 3)).toBeNull()
    expect(effectAtRank(track('speed'), 9)).toBe('+10 ft speed')
    expect(effectAtRank(track('fortune-dice'), 10)).toBe('+2 Fortune Dice each run')
    expect(effectAtRank(track('max-hp'), 0)).toBeNull()
  })

  it('every track id matches a payoff track id used by boons', () => {
    expect(STAT_TRACKS.map((t) => t.id).sort()).toEqual(
      ['fortune-dice', 'flat-damage', 'healing-received', 'max-hp', 'opening-temp-hp', 'speed', 'spell-slot-recovery'].sort(),
    )
  })
})
