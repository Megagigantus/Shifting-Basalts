import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import type { Slot } from './boons'
import { applyChoice } from './draftChoice'
import { passDraft } from './draftFlow'
import { finishRoom } from './progress'
import {
  heldPayoffs,
  pointsLeft,
  recover,
  recoveryPresets,
  refundPayoff,
  refreshRecovery,
  setRecoveryPoints,
  spendPayoff,
  trackRank,
} from './recovery'
import { newRunState } from './runFlow'

const makeChar = (
  id: string,
  trackDevotions: Record<string, number> = {},
  casterType: Character['casterType'] = 'none',
): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  casterType,
  trackDevotions,
})

const passAll = (state: RunState): RunState => {
  let next = state
  for (const p of next.players) if (p.draft) next = passDraft(next, p.characterId)
  return next
}

const withSlots = (state: RunState, characterId: string, slots: Slot[]): RunState => ({
  ...state,
  players: state.players.map((p) => (p.characterId === characterId ? { ...p, slots } : p)),
})

describe('recovery point pools', () => {
  it('grants points equal to rank per track on a qualifying clear, regardless of casterType, and null for rank 0', () => {
    // 3 Devotions = rank 1, 15 Devotions = rank 5.
    const both = makeChar('both', { 'spell-slot-recovery': 15, 'martial-resource-recovery': 6 }, 'half')
    const fighterWithSlots = makeChar('fighter', { 'spell-slot-recovery': 3 }, 'none')
    const none = makeChar('none', {})
    const state = refreshRecovery(newRunState('r', 'X', [both, fighterWithSlots, none], []))

    expect(trackRank(state.players[0], 'spell-slot-recovery')).toBe(5)
    expect(trackRank(state.players[0], 'martial-resource-recovery')).toBe(2)
    expect(state.players[0].recoveryPoints).toEqual({
      'spell-slot-recovery': 5,
      'martial-resource-recovery': 2,
    })

    expect(trackRank(state.players[1], 'spell-slot-recovery')).toBe(1)
    expect(state.players[1].recoveryPoints).toEqual({ 'spell-slot-recovery': 1 })

    expect(state.players[2].recoveryPoints).toBeNull()
  })

  it('combat, elite and boss clears refresh points; a Reprieve does not', () => {
    const hero = makeChar('Kael', { 'spell-slot-recovery': 15, 'martial-resource-recovery': 9 }, 'full')
    let state = newRunState('r', 'X', [hero], [])

    // Room 1: combat clear refreshes.
    state = passAll(finishRoom(state, 'combat', () => 0.5))
    expect(state.players[0].recoveryPoints).toEqual({
      'spell-slot-recovery': 5,
      'martial-resource-recovery': 3,
    })

    // Spend some, then take a Reprieve in room 2: leftovers stay untouched.
    state = recover(state, 'Kael', 'spell-slot-recovery', 'slot-1')
    state = recover(state, 'Kael', 'martial-resource-recovery', 'focus')
    state = passAll(finishRoom(state, 'reprieve', () => 0.5))
    expect(state.players[0].recoveryPoints).toEqual({
      'spell-slot-recovery': 3,
      'martial-resource-recovery': 2,
    })

    // Room 3: elite clear refreshes back to rank.
    state = passAll(finishRoom(state, 'elite', () => 0.5))
    expect(state.players[0].recoveryPoints).toEqual({
      'spell-slot-recovery': 5,
      'martial-resource-recovery': 3,
    })

    // Room 4: combat clear so room 5 is the floor 1 boss.
    state = passAll(finishRoom(state, 'combat', () => 0.5))
    state = recover(state, 'Kael', 'martial-resource-recovery', 'rage')
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(0)

    // Boss clear refreshes back to rank.
    state = finishRoom(state, 'boss', () => 0.5)
    expect(state.players[0].recoveryPoints).toEqual({
      'spell-slot-recovery': 5,
      'martial-resource-recovery': 3,
    })
  })

  it('leftovers fade at the next clear instead of stacking with the new points', () => {
    const hero = makeChar('Kael', { 'spell-slot-recovery': 15 }, 'full')
    let state = refreshRecovery(newRunState('r', 'X', [hero], []))
    state = recover(state, 'Kael', 'spell-slot-recovery', 'slot-1') // 3 left
    expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(3)

    state = finishRoom(state, 'combat', () => 0.5)
    expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(5)
  })

  it('finishRoom can skip the refresh, and refreshRecovery refreshes by hand', () => {
    const hero = makeChar('Kael', { 'martial-resource-recovery': 9 })
    let state = refreshRecovery(newRunState('r', 'X', [hero], []))
    state = recover(state, 'Kael', 'martial-resource-recovery', 'superiority') // 1 left

    state = passAll(finishRoom(state, 'combat', () => 0.5, { refreshRecovery: false }))
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(1)

    state = refreshRecovery(state)
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(3)
  })

  it('recover deducts each preset cost, checks only points, and keeps pools separate', () => {
    expect(recoveryPresets('martial-resource-recovery').map((p) => p.cost)).toEqual([1, 2, 2, 3])
    expect(recoveryPresets('spell-slot-recovery').map((p) => p.cost)).toEqual([2, 3, 5, 6, 7])

    // A wizard with martial ranks and no class resources can still recover a Rage use.
    const wizard = makeChar('Wren', { 'spell-slot-recovery': 15, 'martial-resource-recovery': 15 }, 'full')
    let state = setRecoveryPoints(
      setRecoveryPoints(newRunState('r', 'X', [wizard], []), 'Wren', 'spell-slot-recovery', 23),
      'Wren',
      'martial-resource-recovery',
      8,
    )

    for (const [id, left] of [
      ['focus', 7],
      ['superiority', 5],
      ['psionic', 3],
      ['rage', 0],
    ] as const) {
      state = recover(state, 'Wren', 'martial-resource-recovery', id)
      expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(left)
    }
    // Spending martial points left slot points untouched.
    expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(23)

    for (const [id, left] of [
      ['slot-1', 21],
      ['slot-2', 18],
      ['slot-3', 13],
      ['slot-4', 7],
      ['slot-5', 0],
    ] as const) {
      state = recover(state, 'Wren', 'spell-slot-recovery', id)
      expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(left)
    }

    state = setRecoveryPoints(state, 'Wren', 'martial-resource-recovery', 1)
    expect(() => recover(state, 'Wren', 'martial-resource-recovery', 'rage')).toThrow(
      'A Rage use costs 3 points; Wren has 1.',
    )
    expect(() => recover(state, 'Wren', 'martial-resource-recovery', 'unknown')).toThrow('Unknown recovery option')
    expect(() => recover(state, 'Wren', 'unknown-track', 'rage')).toThrow('Unknown recovery track')
  })

  it('spendPayoff deducts 1 from the payoff boon\'s own track pool only, and requires an active held boon', () => {
    const hero = makeChar('Kael', { 'spell-slot-recovery': 9, 'martial-resource-recovery': 6 }, 'full')
    let state = refreshRecovery(newRunState('r', 'X', [hero], []))

    expect(() => spendPayoff(state, 'Kael', 'momentum')).toThrow("Kael doesn't hold Momentum.")
    expect(() => spendPayoff(state, 'Kael', 'leyline-surge')).toThrow("Kael doesn't hold Leyline Surge.")

    state = withSlots(state, 'Kael', [
      { kind: 'boon', boonId: 'momentum', level: 1 },
      { kind: 'boon', boonId: 'leyline-surge', level: 2 },
      null,
    ])
    expect(heldPayoffs(state.players[0], 'martial-resource-recovery')).toEqual([
      { boonId: 'momentum', name: 'Momentum', level: 1 },
    ])

    state = spendPayoff(state, 'Kael', 'momentum')
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(1)
    expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(3)

    state = spendPayoff(state, 'Kael', 'momentum')
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(0)
    // Martial pool is 0 even though slot points remain.
    expect(() => spendPayoff(state, 'Kael', 'momentum')).toThrow('Kael has no Martial recovery points left.')

    state = spendPayoff(state, 'Kael', 'leyline-surge')
    expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(2)

    // Suppressed slot cannot spend.
    state = withSlots(state, 'Kael', [
      { kind: 'boon', boonId: 'momentum', level: 1 },
      { kind: 'boon', boonId: 'leyline-surge', level: 2, suppressed: true },
      null,
    ])
    expect(() => spendPayoff(state, 'Kael', 'leyline-surge')).toThrow("Kael doesn't hold Leyline Surge.")
  })

  it('refundPayoff adds 1 to the boon\'s track pool at Level 3 and rejects lower levels', () => {
    const hero = makeChar('Kael', { 'spell-slot-recovery': 3, 'martial-resource-recovery': 3 }, 'full')
    let state = refreshRecovery(newRunState('r', 'X', [hero], []))
    state = withSlots(state, 'Kael', [
      { kind: 'boon', boonId: 'momentum', level: 2 },
      { kind: 'boon', boonId: 'leyline-surge', level: 3 },
      null,
    ])

    expect(() => refundPayoff(state, 'Kael', 'momentum')).toThrow('Refunds need Momentum at Level 3.')
    state = refundPayoff(state, 'Kael', 'leyline-surge')
    expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(2)

    state = withSlots(state, 'Kael', [
      { kind: 'boon', boonId: 'momentum', level: 3 },
      { kind: 'boon', boonId: 'leyline-surge', level: 3 },
      null,
    ])
    state = refundPayoff(state, 'Kael', 'momentum')
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(2)
  })

  it('setRecoveryPoints sets a balance and rejects negative, fractional or unknown tracks', () => {
    const hero = makeChar('Kael', {})
    let state = newRunState('r', 'X', [hero], [])
    state = setRecoveryPoints(state, 'Kael', 'martial-resource-recovery', 4)
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(4)
    state = setRecoveryPoints(state, 'Kael', 'martial-resource-recovery', 0)
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(0)

    expect(() => setRecoveryPoints(state, 'Kael', 'martial-resource-recovery', -1)).toThrow('whole number')
    expect(() => setRecoveryPoints(state, 'Kael', 'martial-resource-recovery', 1.5)).toThrow('whole number')
    expect(() => setRecoveryPoints(state, 'Kael', 'not-a-track', 2)).toThrow('Unknown recovery track')
  })

  it('applyChoice routes recover, payoffSpend and payoffRefund', () => {
    const hero = makeChar('Kael', { 'spell-slot-recovery': 9, 'martial-resource-recovery': 9 }, 'full')
    let state = refreshRecovery(newRunState('r', 'X', [hero], []))
    state = withSlots(state, 'Kael', [{ kind: 'boon', boonId: 'momentum', level: 3 }, null, null])

    state = applyChoice(
      state,
      'Kael',
      { action: 'recover', track: 'spell-slot-recovery', presetId: 'slot-1' },
      () => 0.5,
    )
    expect(pointsLeft(state.players[0], 'spell-slot-recovery')).toBe(1)

    state = applyChoice(state, 'Kael', { action: 'payoffSpend', boonId: 'momentum' }, () => 0.5)
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(2)

    state = applyChoice(state, 'Kael', { action: 'payoffRefund', boonId: 'momentum' }, () => 0.5)
    expect(pointsLeft(state.players[0], 'martial-resource-recovery')).toBe(3)
  })
})
