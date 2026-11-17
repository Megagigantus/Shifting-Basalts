import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import { BOONS, COMBINATIONS, EVOLUTIONS, HIDDEN_BOONS, emptySlots, replaceBoon, takeBoon, type Slot } from './boons'
import { echoCounts, echoesOf, emptyEchoes, mergeEchoes, recordEchoes, type Echoes } from './echoes'
import { changeSlots, newRunState, setHiddenBoon } from './runFlow'

const char = (id: string): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
})

describe('echoesOf', () => {
  it('returns empty groups when nothing is held', () => {
    expect(echoesOf(undefined)).toEqual(emptyEchoes())
    expect(echoesOf(emptySlots(3), null)).toEqual(emptyEchoes())
  })

  it('records a plain boon, an Evolution with its source boon, a Combination with both boons, and a hidden boon', () => {
    const slots: Slot[] = [
      { kind: 'boon', boonId: 'hardy', level: 2 },
      { kind: 'evolution', evolutionId: 'chain-of-echoes' },
      { kind: 'combination', combinationId: 'super-normal' },
    ]
    expect(echoesOf(slots, 'keeper-of-ways')).toEqual({
      boons: ['hardy', 'traverts-echoes', 'critical-delight', 'crits-are-for-suckers'],
      evolutions: ['chain-of-echoes'],
      combinations: ['super-normal'],
      hidden: ['keeper-of-ways'],
    })
  })
})

describe('mergeEchoes', () => {
  it('unions each group in first-seen order without duplicates, and handles undefined or partial records', () => {
    expect(mergeEchoes(undefined, null)).toEqual(emptyEchoes())

    const older = { boons: ['hardy', 'honed'] } as Echoes
    const newer: Echoes = {
      boons: ['honed', 'fleet-foot'],
      evolutions: ['chain-of-echoes'],
      combinations: ['super-normal'],
      hidden: ['keeper-of-ways'],
    }
    expect(mergeEchoes(older, newer)).toEqual({
      boons: ['hardy', 'honed', 'fleet-foot'],
      evolutions: ['chain-of-echoes'],
      combinations: ['super-normal'],
      hidden: ['keeper-of-ways'],
    })
  })
})

describe('recordEchoes', () => {
  it('keeps the same state reference when nothing is new', () => {
    const initial = newRunState('r1', 'ABCD', [char('c0'), char('c1')], [])
    expect(recordEchoes(initial)).toBe(initial)

    const withBoon = recordEchoes(changeSlots(initial, 'c0', (s) => takeBoon(s, 'hardy')))
    expect(withBoon).not.toBe(initial)
    expect(withBoon.players[1]).toBe(initial.players[1])
    expect(recordEchoes(withBoon)).toBe(withBoon)
  })

  it('keeps a boon that is later replaced in a slot', () => {
    let state = newRunState('r1', 'ABCD', [char('c0')], [])
    state = recordEchoes(changeSlots(state, 'c0', (s) => takeBoon(s, 'hardy')))
    state = changeSlots(state, 'c0', (s) => replaceBoon(s, 0, 'night-eyes'))
    state = setHiddenBoon(state, 'c0', 'keeper-of-ways')
    state = recordEchoes(state)

    expect(state.players[0].echoes).toEqual({
      boons: ['hardy', 'night-eyes'],
      evolutions: [],
      combinations: [],
      hidden: ['keeper-of-ways'],
    })
  })
})

describe('echoCounts', () => {
  it('counts each group against the data, with hidden limited to gifts plus own classes', () => {
    const empty = echoCounts({ classId: 'fighter' })
    expect(empty.boons).toEqual({ seen: 0, total: BOONS.length })
    expect(empty.evolutions.total).toBe(EVOLUTIONS.length)
    expect(empty.combinations.total).toBe(COMBINATIONS.length)
    const gifts = HIDDEN_BOONS.filter((h) => h.kind === 'gift').length
    expect(empty.hidden.total).toBe(gifts + 1)
    expect(echoCounts({ classId: 'fighter', secondClassId: 'wizard' }).hidden.total).toBe(gifts + 2)
    expect(echoCounts({ classId: 'homebrew' }).hidden.total).toBe(gifts)
  })

  it('counts seen ids once, ignores ids no longer in the data, and sums overall', () => {
    const c = {
      classId: 'fighter',
      echoes: { boons: [BOONS[0].id, BOONS[1].id, 'retired-boon'], evolutions: [EVOLUTIONS[0].id], combinations: [], hidden: [] },
    }
    const counts = echoCounts(c)
    expect(counts.boons.seen).toBe(2)
    expect(counts.evolutions.seen).toBe(1)
    expect(counts.overall.seen).toBe(3)
    expect(counts.overall.total).toBe(counts.boons.total + counts.evolutions.total + counts.combinations.total + counts.hidden.total)
  })
})
