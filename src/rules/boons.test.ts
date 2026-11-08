import { describe, expect, it } from 'vitest'
import {
  availableCombinations,
  BOONS,
  clearSlot,
  combine,
  COMBINATIONS,
  emptySlots,
  evolutionFor,
  evolve,
  EVOLUTIONS,
  fitSlots,
  HIDDEN_BOONS,
  levelUp,
  replaceBoon,
  setSuppressed,
  slotCount,
  slotName,
  slotTags,
  takeBoon,
  type Slot,
} from './boons'

/** Take a boon three times: Level 1, then 2, then 3. */
const toLevel3 = (slots: Slot[], id: string) => takeBoon(takeBoon(takeBoon(slots, id), id), id)

describe('the catalogue', () => {
  it('matches the bible counts', () => {
    expect(BOONS).toHaveLength(69)
    expect(EVOLUTIONS).toHaveLength(49)
    expect(COMBINATIONS).toHaveLength(21)
    expect(HIDDEN_BOONS.filter((h) => h.kind === 'class')).toHaveLength(12)
    expect(HIDDEN_BOONS.filter((h) => h.kind === 'gift')).toHaveLength(8)
  })
})

describe('slots', () => {
  it('start at 3, plus one per Extra Boon Slot rank', () => {
    expect([0, 1, 2].map(slotCount)).toEqual([3, 4, 5])
  })

  it('grow after buying a slot without losing boons', () => {
    const slots = takeBoon(emptySlots(3), 'fleet-foot')
    const grown = fitSlots(slots, 4)
    expect(grown).toHaveLength(4)
    expect(grown[0]).toEqual(slots[0])
    expect(fitSlots(undefined, 3)).toEqual([null, null, null])
  })
})

describe('taking boons', () => {
  it('fills the first empty slot at Level 1', () => {
    const slots = takeBoon(emptySlots(3), 'hardy')
    expect(slots[0]).toEqual({ kind: 'boon', boonId: 'hardy', level: 1 })
  })

  it('levels up a held boon instead, to Level 3 at most', () => {
    const slots = toLevel3(emptySlots(3), 'hardy')
    expect(slots.filter(Boolean)).toHaveLength(1)
    expect(slots[0]).toMatchObject({ level: 3 })
    expect(() => takeBoon(slots, 'hardy')).toThrow('already Level 3')
  })

  it('refuses when all slots are full', () => {
    let slots = emptySlots(3)
    for (const id of ['hardy', 'honed', 'fleet-foot']) slots = takeBoon(slots, id)
    expect(() => takeBoon(slots, 'night-eyes')).toThrow('No empty slot')
  })

  it('replace drops a boon for a new one at Level 1', () => {
    let slots = toLevel3(emptySlots(3), 'hardy')
    slots = replaceBoon(slots, 0, 'night-eyes')
    expect(slots[0]).toEqual({ kind: 'boon', boonId: 'night-eyes', level: 1 })
  })

  it('a boon can\'t be held twice', () => {
    const slots = takeBoon(takeBoon(emptySlots(3), 'hardy'), 'honed')
    expect(() => replaceBoon(slots, 1, 'hardy')).toThrow('already held')
  })
})

describe('evolving', () => {
  it('needs a Level 3 normal boon with an Evolution', () => {
    let slots = takeBoon(emptySlots(3), 'traverts-echoes')
    expect(evolutionFor(slots[0])).toBeNull()
    expect(() => evolve(slots, 0)).toThrow()
    slots = toLevel3(emptySlots(3), 'traverts-echoes')
    expect(evolutionFor(slots[0])?.id).toBe('chain-of-echoes')
    slots = evolve(slots, 0)
    expect(slots[0]).toEqual({ kind: 'evolution', evolutionId: 'chain-of-echoes' })
    expect(slotName(slots[0]!)).toBe('Chain of Echoes')
  })

  it('Core and Payoff boons never evolve', () => {
    expect(evolutionFor(toLevel3(emptySlots(3), 'hardy')[0])).toBeNull()
    expect(evolutionFor(toLevel3(emptySlots(3), 'spillover')[0])).toBeNull()
  })

  it('keeps its source boon\'s tag', () => {
    const slots = evolve(toLevel3(emptySlots(3), 'traverts-echoes'), 0)
    expect(slotTags(slots[0]!)).toEqual(['Echo'])
  })

  it('blocks drafting the source boon again after evolving', () => {
    const slots = evolve(toLevel3(emptySlots(3), 'traverts-echoes'), 0)
    expect(() => takeBoon(slots, 'traverts-echoes')).toThrow('already part of')
  })
})

describe('combining', () => {
  it('fuses two Level 3 partners into the first slot and frees the second', () => {
    let slots = toLevel3(emptySlots(3), 'critical-delight')
    slots = takeBoon(slots, 'fleet-foot')
    slots = toLevel3(slots, 'crits-are-for-suckers')
    expect(availableCombinations(slots).map((o) => o.combination.id)).toEqual(['super-normal'])
    slots = combine(slots, 'super-normal')
    expect(slots[0]).toEqual({ kind: 'combination', combinationId: 'super-normal' })
    expect(slots[1]).toMatchObject({ boonId: 'fleet-foot' })
    expect(slots[2]).toBeNull()
  })

  it('needs both boons at Level 3', () => {
    let slots = toLevel3(emptySlots(3), 'critical-delight')
    slots = takeBoon(slots, 'crits-are-for-suckers')
    expect(availableCombinations(slots)).toEqual([])
    expect(() => combine(slots, 'super-normal')).toThrow()
  })

  it('offers every pair a boon can join, and carries both tags', () => {
    let slots = toLevel3(emptySlots(3), 'critical-delight')
    slots = toLevel3(slots, 'elemains-flight-of-fancy')
    slots = toLevel3(slots, 'traverts-echoes')
    const ids = availableCombinations(slots).map((o) => o.combination.id).sort()
    expect(ids).toEqual(['elemains-fancy-criticals', 'shooting-gallery'])
    slots = combine(slots, 'shooting-gallery')
    expect(slotTags(slots.find((s) => s?.kind === 'combination')!).sort()).toEqual(['Echo', 'Volley'])
  })

  it('combinations are final: they can\'t evolve or level', () => {
    let slots = toLevel3(emptySlots(3), 'critical-delight')
    slots = combine(toLevel3(slots, 'crits-are-for-suckers'), 'super-normal')
    expect(evolutionFor(slots[0])).toBeNull()
    expect(() => levelUp(slots, 0)).toThrow()
  })
})

describe('suppressing and clearing', () => {
  it('marks a slot suppressed and back', () => {
    let slots = takeBoon(emptySlots(3), 'hardy')
    slots = setSuppressed(slots, 0, true)
    expect(slots[0]).toMatchObject({ suppressed: true })
    slots = setSuppressed(slots, 0, false)
    expect(slots[0]).toMatchObject({ suppressed: false })
    expect(() => setSuppressed(slots, 1, true)).toThrow('empty')
  })

  it('clears a slot', () => {
    expect(clearSlot(takeBoon(emptySlots(3), 'hardy'), 0)[0]).toBeNull()
  })
})
