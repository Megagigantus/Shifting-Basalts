import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { shiftEffectOf } from './battleMap'
import { clearSlot, combine, emptySlots, evolve, setSuppressed, takeBoon, type Slot } from './boons'
import { changeSlots, markDead, newRunState, setHiddenBoon } from './runFlow'
import { applyBoonSuppression, eligibleSuppressSlots, planBoonSuppression } from './suppression'

const char = (id: string): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 10,
})

const toLevel3 = (slots: Slot[], id: string) => takeBoon(takeBoon(takeBoon(slots, id), id), id)

function start(party: Character[]): RunState {
  return newRunState('r1', 'ABCD', party, [])
}

describe('eligibleSuppressSlots', () => {
  it('returns only plain unsuppressed boon indexes', () => {
    let slots = emptySlots(6)
    slots = toLevel3(slots, 'critical-delight')
    slots = toLevel3(slots, 'crits-are-for-suckers')
    slots = combine(slots, 'super-normal') // slot 0: combination, slot 1: null
    slots = toLevel3(slots, 'traverts-echoes')
    slots = evolve(slots, 1) // slot 1: evolution
    slots = takeBoon(slots, 'overhealing') // slot 2: plain boon
    slots = takeBoon(slots, 'hardened-hide') // slot 3: plain boon (will be suppressed)
    slots = setSuppressed(slots, 3, true)
    slots = takeBoon(slots, 'cleansing-nova') // slot 4: plain boon
    // slot 5: null

    expect(eligibleSuppressSlots(slots)).toEqual([2, 4])
    expect(eligibleSuppressSlots(emptySlots(3))).toEqual([])
    expect(eligibleSuppressSlots(undefined)).toEqual([])
  })
})

describe('planBoonSuppression', () => {
  it('picks one boon per living player including vanished, skips dead and ineligible players', () => {
    let state = start([
      char('alive'),
      { ...char('vanished'), upgrades: { 'lost-and-found': 1 } },
      char('dead'),
      char('no-eligible'),
    ])
    state = changeSlots(state, 'alive', (s) => takeBoon(s, 'overhealing'))
    state = changeSlots(state, 'vanished', (s) => takeBoon(s, 'hardened-hide'))
    // Put a hidden boon on vanished too; it must never be picked as a slot.
    state = setHiddenBoon(state, 'vanished', 'keeper-of-ways')
    state = markDead(state, 'vanished', () => 1) // Lost and Found vanishes instead of dying
    expect(state.players.find((p) => p.characterId === 'vanished')?.alive).toBe(true)
    expect(state.players.find((p) => p.characterId === 'vanished')?.vanished).toBeTruthy()

    state = changeSlots(state, 'dead', (s) => takeBoon(s, 'cleansing-nova'))
    state = markDead(state, 'dead', () => 1)
    expect(state.players.find((p) => p.characterId === 'dead')?.alive).toBe(false)

    state = changeSlots(state, 'no-eligible', (s) => evolve(toLevel3(s, 'traverts-echoes'), 0))

    const picks = planBoonSuppression(state.players, 1, () => 0)
    expect(picks).toEqual([
      { characterId: 'alive', slotIndex: 0, name: 'Overhealing' },
      { characterId: 'vanished', slotIndex: 0, name: 'Hardened Hide' },
    ])
  })

  it('uses random to select first or last eligible slot', () => {
    let state = start([char('a')])
    state = changeSlots(state, 'a', (s) =>
      takeBoon(takeBoon(takeBoon(s, 'overhealing'), 'hardened-hide'), 'cleansing-nova'),
    )

    expect(planBoonSuppression(state.players, 1, () => 0)).toEqual([
      { characterId: 'a', slotIndex: 0, name: 'Overhealing' },
    ])
    expect(planBoonSuppression(state.players, 1, () => 0.99)).toEqual([
      { characterId: 'a', slotIndex: 2, name: 'Cleansing Nova' },
    ])
  })

  it('count 2 picks two distinct slots, or as many as available', () => {
    let state = start([char('two-plus'), char('only-one')])
    state = changeSlots(state, 'two-plus', (s) =>
      takeBoon(takeBoon(takeBoon(s, 'overhealing'), 'hardened-hide'), 'cleansing-nova'),
    )
    state = changeSlots(state, 'only-one', (s) => takeBoon(s, 'overchannel'))

    const picksFromStart = planBoonSuppression(state.players, 2, () => 0)
    expect(picksFromStart).toEqual([
      { characterId: 'two-plus', slotIndex: 0, name: 'Overhealing' },
      { characterId: 'two-plus', slotIndex: 1, name: 'Hardened Hide' },
      { characterId: 'only-one', slotIndex: 0, name: 'Overchannel' },
    ])

    const picksFromEnd = planBoonSuppression(state.players, 2, () => 0.99)
    expect(picksFromEnd).toEqual([
      { characterId: 'two-plus', slotIndex: 2, name: 'Cleansing Nova' },
      { characterId: 'two-plus', slotIndex: 1, name: 'Hardened Hide' },
      { characterId: 'only-one', slotIndex: 0, name: 'Overchannel' },
    ])
  })
})

describe('applyBoonSuppression', () => {
  it('marks only the picked slots suppressed without mutating input state', () => {
    let state = start([char('a'), char('b')])
    state = changeSlots(state, 'a', (s) => takeBoon(takeBoon(s, 'overhealing'), 'hardened-hide'))
    state = changeSlots(state, 'b', (s) => takeBoon(s, 'cleansing-nova'))
    const snapshot = structuredClone(state)

    const picks = planBoonSuppression([state.players[0]], 1, () => 0.99)
    const next = applyBoonSuppression(state, picks)

    expect(state).toEqual(snapshot)
    expect(next.players[0].slots?.[0]).toEqual({ kind: 'boon', boonId: 'overhealing', level: 1 })
    expect(next.players[0].slots?.[1]).toEqual({
      kind: 'boon',
      boonId: 'hardened-hide',
      level: 1,
      suppressed: true,
    })
    expect(next.players[1].slots?.[0]).toEqual({ kind: 'boon', boonId: 'cleansing-nova', level: 1 })
  })

  it('skips stale picks silently without throwing', () => {
    let state = start([char('a'), char('b')])
    state = changeSlots(state, 'a', (s) => takeBoon(takeBoon(s, 'overhealing'), 'hardened-hide'))
    state = changeSlots(state, 'b', (s) => takeBoon(s, 'cleansing-nova'))

    const staleBefore = [
      { characterId: 'a', slotIndex: 0, name: 'Overhealing' }, // will be cleared
      { characterId: 'a', slotIndex: 1, name: 'Hardened Hide' }, // already suppressed
      { characterId: 'a', slotIndex: 99, name: 'Missing' }, // out of bounds
      { characterId: 'missing-player', slotIndex: 0, name: 'Ghost' }, // unknown player
      { characterId: 'b', slotIndex: 0, name: 'Cleansing Nova' }, // valid
    ]

    state = changeSlots(state, 'a', (s) => clearSlot(s, 0))
    state = changeSlots(state, 'a', (s) => setSuppressed(s, 1, true))

    const next = applyBoonSuppression(state, staleBefore)
    expect(next.players[0].slots?.[0]).toBeNull()
    expect(next.players[0].slots?.[1]).toMatchObject({ boonId: 'hardened-hide', suppressed: true })
    expect(next.players[1].slots?.[0]).toMatchObject({ boonId: 'cleansing-nova', suppressed: true })
  })
})

describe('Inverted Reliquary data', () => {
  it('has suppressBoons with count 1 on Slot Scramble', () => {
    const effect = shiftEffectOf('inverted-reliquary')
    expect(effect?.kind).toBe('chasms')
    if (effect?.kind === 'chasms') {
      expect(effect.suppressBoons).toEqual({
        count: 1,
        note: 'suppressed until they cross to a different island',
      })
    }
  })
})
