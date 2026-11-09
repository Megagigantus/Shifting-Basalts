import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { declineReprieve, enterRoom, reveal, spendHiddenSight, startFloor } from './roomFlow'
import { conditionOf } from './rooms'
import { clearRoom, defeatBoss, descend, newRunState } from './runFlow'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const char = (id: string, upgrades: Record<string, number> = {}): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  upgrades,
})

const start = (chars = [char('a'), char('b')], seed = 1) => startFloor(newRunState('r', 'X', chars, []), seeded(seed))

describe('entering rooms', () => {
  it('a new run plans floor 1 and enters room 1, with a player view', () => {
    const state = start()
    expect(state.dm?.floorPlan).toHaveLength(4)
    expect(state.dm?.floorPlan[0]).toBe('combat')
    expect(state.dm?.room).toMatchObject({ floor: 1, room: 1, kind: 'combat' })
    expect(state.run.roomView).toMatchObject({ floor: 1, room: 1, trueExit: null, condition: null })
  })

  it('each cleared room enters the next one, following the plan', () => {
    let state = start()
    state = enterRoom(clearRoom(state, 'combat'), seeded(2))
    expect(state.dm?.room).toMatchObject({ room: 2, kind: state.dm?.floorPlan[1] })
  })

  it('reaches a large boss room, then no room after the boss, then plans the next floor', () => {
    let state = start()
    for (let i = 0; i < 4; i++) state = enterRoom(clearRoom(state, 'combat'), seeded(10 + i))
    expect(state.dm?.room).toMatchObject({ kind: 'boss', size: 'large', condition: null, tricks: [] })
    state = enterRoom(defeatBoss(state), seeded(20))
    expect(state.dm?.room).toBeNull()
    expect(state.run.roomView).toBeNull()
    state = startFloor(descend(state), seeded(21))
    expect(state.dm?.room).toMatchObject({ floor: 2, room: 1 })
  })
})

describe('reveals', () => {
  it('update the player view without exposing anything else', () => {
    let state = start()
    const room = state.dm!.room!
    state = reveal(state, 'trueExit')
    expect(state.run.roomView?.trueExit).toBe(room.trueExit)
    expect(state.run.roomView?.condition).toBeNull()
    state = reveal(state, 'condition')
    expect(state.run.roomView?.condition).toBe(room.condition)
  })

  it('reveal one trick at a time', () => {
    // Floor 4 rooms always have tricks.
    let state = start([char('a')], 3)
    state = { ...state, run: { ...state.run, floor: 4 } }
    state = startFloor(state, seeded(5))
    const [first, second] = state.dm!.room!.tricks
    state = reveal(state, { trick: first.id })
    expect(state.run.roomView?.tricks).toEqual([first.id])
    expect(state.run.roomView?.tricks).not.toContain(second?.id)
  })
})

describe('Reprieve', () => {
  it('can be declined and fought as a combat room instead', () => {
    let state = start()
    state = {
      ...state,
      dm: { floorPlan: ['combat', 'reprieve', 'combat', 'combat'], room: state.dm!.room },
      run: { ...state.run, room: 2 },
    }
    state = enterRoom(state, seeded(6))
    expect(state.dm?.room?.kind).toBe('reprieve')
    state = declineReprieve(state, seeded(7))
    expect(state.dm?.room?.kind).toBe('combat')
    expect(state.dm?.floorPlan[1]).toBe('combat')
    expect(() => declineReprieve(state, seeded(8))).toThrow('isn\'t a Reprieve')
  })

  it('owners\' ranks feed the floor plan', () => {
    let reprieves = 0
    for (let seed = 1; seed <= 200; seed++) {
      if (start([char('a', { reprieve: 4 }), char('b', { reprieve: 4 })], seed).dm!.floorPlan.includes('reprieve')) reprieves++
    }
    expect(reprieves).toBeGreaterThan(150)
  })
})

describe('Hidden Sight', () => {
  it('gives the owner this room\'s hint once per floor', () => {
    let state: RunState = start([char('a', { 'hidden-sight': 1 }), char('b')])
    const { state: used, hint } = spendHiddenSight(state, 'a')
    expect(hint).toBe(conditionOf(state.dm!.room!.condition!).hint)
    expect(used.players[0].hiddenSightFloor).toBe(1)
    expect(() => spendHiddenSight(used, 'a')).toThrow('already used')
    expect(() => spendHiddenSight(state, 'b')).toThrow('doesn\'t have Hidden Sight')
    state = startFloor(descend(enterRoom(defeatBoss(clearAll(used)), seeded(30))), seeded(31))
    expect(() => spendHiddenSight(state, 'a')).not.toThrow()
  })

  it('has nothing to hint at in a boss room', () => {
    let state = start([char('a', { 'hidden-sight': 1 })])
    for (let i = 0; i < 4; i++) state = enterRoom(clearRoom(state, 'combat'), seeded(40 + i))
    expect(() => spendHiddenSight(state, 'a')).toThrow('no secret condition')
  })
})

function clearAll(state: RunState): RunState {
  for (let i = 0; i < 4; i++) state = enterRoom(clearRoom(state, 'combat'), seeded(50 + i))
  return state
}

describe('the DM-only part of a run', () => {
  it('survives every run step', async () => {
    const { markDead } = await import('./runFlow')
    const { openDrafts, passDraft } = await import('./draftFlow')
    const { spendForge } = await import('./forge')
    const { changeSlots } = await import('./runFlow')
    const { takeBoon } = await import('./boons')
    let state = start([char('a', { forge: 1 }), char('b')])
    const plan = state.dm!.floorPlan
    state = openDrafts(clearRoom(state, 'combat'), 'combat', seeded(60))
    expect(state.dm?.floorPlan).toEqual(plan)
    state = passDraft(passDraft(state, 'a'), 'b')
    expect(state.dm?.floorPlan).toEqual(plan)
    state = markDead(state, 'b', () => 1)
    expect(state.dm?.floorPlan).toEqual(plan)
    for (let i = 0; i < 3; i++) state = clearRoom(state, 'combat')
    state = changeSlots(defeatBoss(state), 'a', (s) => takeBoon(s, 'hardy'))
    expect(state.dm?.floorPlan).toEqual(plan)
    state = spendForge(state, 'a', { kind: 'level', slotIndex: 0 })
    expect(state.dm?.floorPlan).toEqual(plan)
  })
})
