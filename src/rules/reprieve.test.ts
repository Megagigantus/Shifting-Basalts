import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { applyChoice } from './draftChoice'
import { passDraft } from './draftFlow'
import { finishRoom } from './progress'
import {
  canTakeCatchUp,
  catchUpBasalts,
  chooseReprieve,
  currentReprieveChoice,
  describeReprieve,
  inReprieve,
  reflectableSlots,
  reprieveWaitingOn,
} from './reprieve'
import { enterRoom, startFloor } from './roomFlow'
import { markDead, newRunState, waitingOn } from './runFlow'

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const char = (id: string, level = 5): Character => ({ ...emptyProfile(), ...emptyDungeonLayer(), id, name: id, level })

/** A run standing in a Reprieve (room 2), with 'a' holding a Level 1 and a Level 3 boon and 'b' only a Level 3 boon. */
function inAReprieve(level = 5): RunState {
  let state = startFloor(newRunState('r', 'X', [char('a', level), char('b', level)], []), seeded(1))
  for (const p of state.players) if (p.draft) state = passDraft(state, p.characterId)
  state = {
    ...state,
    dm: { ...state.dm!, floorPlan: ['combat', 'reprieve', 'combat', 'combat'] },
    run: { ...state.run, room: 2 },
    players: state.players.map((p) =>
      p.characterId === 'a'
        ? { ...p, slots: [{ kind: 'boon', boonId: 'reapers-sprint', level: 1 }, { kind: 'boon', boonId: 'traverts-echoes', level: 3 }, null] }
        : { ...p, slots: [{ kind: 'boon', boonId: 'traverts-echoes', level: 3 }, null, null] },
    ),
  }
  return enterRoom(state, seeded(2))
}

describe('Reprieve choices', () => {
  it('knows when the party is in a Reprieve, from the player-safe room view', () => {
    const state = inAReprieve()
    expect(state.run.roomView?.kind).toBe('reprieve')
    expect(inReprieve(state)).toBe(true)
    expect(reprieveWaitingOn(state)).toEqual(['a', 'b'])
    expect(waitingOn(state)).toEqual(['a', 'b'])
  })

  it('Rest is only recorded', () => {
    const before = inAReprieve()
    const state = chooseReprieve(before, 'a', { kind: 'rest' })
    const a = state.players[0]
    expect(currentReprieveChoice(state, a)).toEqual({ floor: 1, room: 2, choice: 'rest' })
    expect(a.slots).toEqual(before.players[0].slots)
    expect(a.quantumBasaltsPassed).toBe(before.players[0].quantumBasaltsPassed)
    expect(reprieveWaitingOn(state)).toEqual(['b'])
  })

  it('Reflect levels up one boon below Level 3', () => {
    const state = chooseReprieve(inAReprieve(), 'a', { kind: 'reflect', slotIndex: 0 })
    expect(state.players[0].slots?.[0]).toEqual({ kind: 'boon', boonId: 'reapers-sprint', level: 2 })
    expect(describeReprieve(currentReprieveChoice(state, state.players[0])!)).toBe("Reflected: Reaper's Sprint to Level 2")
    expect(() => chooseReprieve(inAReprieve(), 'a', { kind: 'reflect', slotIndex: 1 })).toThrow('below Level 3')
    expect(() => chooseReprieve(inAReprieve(), 'a', { kind: 'reflect', slotIndex: 2 })).toThrow('below Level 3')
  })

  it('catch-up Basalts only when no boon can level, worth a pass and counted as passed', () => {
    const state = inAReprieve()
    expect(reflectableSlots(state.players[0].slots)).toEqual([0])
    expect(canTakeCatchUp(state.players[0])).toBe(false)
    expect(canTakeCatchUp(state.players[1])).toBe(true)
    expect(() => chooseReprieve(state, 'a', { kind: 'basalts' })).toThrow('no boon to level')
    const after = chooseReprieve(state, 'b', { kind: 'basalts' })
    expect(after.players[1].quantumBasaltsPassed).toBe(state.players[1].quantumBasaltsPassed + 1)
    expect(after.players[1].passes).toBe(state.players[1].passes)
  })

  it('catch-up Basalts follow the entry multiplier (tier 2 pays 2)', () => {
    const state = inAReprieve(11)
    expect(catchUpBasalts(state)).toBe(2)
    expect(chooseReprieve(state, 'b', { kind: 'basalts' }).players[1].quantumBasaltsPassed).toBe(state.players[1].quantumBasaltsPassed + 2)
  })

  it('one choice per player per Reprieve, and only in a Reprieve', () => {
    const state = chooseReprieve(inAReprieve(), 'a', { kind: 'rest' })
    expect(() => chooseReprieve(state, 'a', { kind: 'reflect', slotIndex: 0 })).toThrow('already chosen')
    const notThere = startFloor(newRunState('r', 'X', [char('a')], []), seeded(3))
    expect(() => chooseReprieve(notThere, 'a', { kind: 'rest' })).toThrow("isn't in a Reprieve")
  })

  it('fallen players are skipped and can\'t choose', () => {
    const state = markDead(inAReprieve(), 'b')
    expect(reprieveWaitingOn(state)).toEqual(['a'])
    expect(() => chooseReprieve(state, 'b', { kind: 'rest' })).toThrow('fallen')
  })

  it('the party leaves only once everyone has chosen, with no Devotion or draft', () => {
    let state = inAReprieve()
    expect(() => finishRoom(state, 'reprieve', seeded(4))).toThrow('Waiting on Reprieve choices from a, b')
    state = chooseReprieve(state, 'a', { kind: 'reflect', slotIndex: 0 })
    state = chooseReprieve(state, 'b', { kind: 'basalts' })
    const devotions = state.players.map((p) => p.devotions)
    const next = finishRoom(state, 'reprieve', seeded(4))
    expect(next.run.room).toBe(3)
    expect(next.players.map((p) => p.devotions)).toEqual(devotions)
    expect(next.players.every((p) => !p.draft)).toBe(true)
    expect(next.players[0].reprieves).toHaveLength(1)
  })

  it('players\' devices send the same choices through applyChoice', () => {
    let state = inAReprieve()
    state = applyChoice(state, 'a', { action: 'reprieveReflect', slotIndex: 0 }, seeded(5))
    state = applyChoice(state, 'b', { action: 'reprieveRest' }, seeded(5))
    expect(state.players[0].slots?.[0]).toMatchObject({ level: 2 })
    expect(reprieveWaitingOn(state)).toEqual([])
    expect(() => applyChoice(inAReprieve(), 'a', { action: 'reprieveBasalts' }, seeded(5))).toThrow('no boon to level')
  })
})
