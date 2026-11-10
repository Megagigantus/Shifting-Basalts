import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import {
  declineReprieve,
  enterRoom,
  rerollBoss,
  rerollEncounter,
  reveal,
  spendHiddenSight,
  startFloor,
} from './roomFlow'
import { conditionOf } from './rooms'
import { clearRoom, defeatBoss, descend, markDead, newRunState } from './runFlow'
import { bossesOnFloor } from './bosses'

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

describe('encounters and bosses', () => {
  it('each floor picks one of its bosses, and combat rooms get a hidden encounter', () => {
    const state = start()
    expect(bossesOnFloor(1).map((b) => b.id)).toContain(state.dm?.bossId)
    const room = state.dm!.room!
    expect(room.encounter?.groups.length).toBeGreaterThan(0)
    expect(room.boss).toBeNull()
    expect(state.run.roomView?.enemies).toEqual([])
    expect(state.run.roomView?.bossId).toBeNull()
  })

  it('reveals one enemy group or all of them, by name only', () => {
    let state = start()
    const groups = state.dm!.room!.encounter!.groups
    state = reveal(state, { enemy: 0 })
    expect(state.run.roomView?.enemies?.[0]).toEqual({ creatureId: groups[0].creatureId, count: groups[0].count })
    state = reveal(state, 'enemies')
    const shown = state.run.roomView!.enemies!.reduce((s, e) => s + e.count, 0)
    expect(shown).toBe(groups.reduce((s, g) => s + g.count, 0))
    expect(JSON.stringify(state.run.roomView)).not.toMatch(/"cr"|"hp"|"ac"/)
  })

  it('a boss room fights the floor\'s boss, sized to the living party, with its Shift Action hidden', () => {
    let state = start([char('a'), char('b'), char('c')])
    const bossId = state.dm!.bossId
    state = markDead(state, 'c', () => 1)
    for (let i = 0; i < 4; i++) state = enterRoom(clearRoom(state, 'combat'), seeded(70 + i))
    expect(state.dm?.room?.boss).toEqual({ id: bossId, partySize: 2 })
    expect(state.dm?.room?.encounter).toBeNull()
    expect(state.run.roomView?.bossId).toBe(bossId)
    expect(state.run.roomView?.shifts).toEqual([])
    state = reveal(state, { shift: bossId! })
    expect(state.run.roomView?.shifts).toEqual([bossId])
  })

  it('rerolling the boss picks a different one, and rebuilds the boss room', () => {
    let state = start()
    const first = state.dm!.bossId
    state = rerollBoss(state, seeded(80))
    expect(state.dm?.bossId).not.toBe(first)
    for (let i = 0; i < 4; i++) state = enterRoom(clearRoom(state, 'combat'), seeded(81 + i))
    const again = rerollBoss(state, seeded(90))
    expect(again.dm?.room?.boss?.id).toBe(again.dm?.bossId)
    expect(again.run.roomView?.bossId).toBe(again.dm?.bossId)
  })

  it('Restless Stone gives rooms Shift Actions from the floor\'s other bosses', () => {
    let state = startFloor(newRunState('r', 'X', [char('a'), char('b')], ['restless-stone-2']), seeded(5))
    for (let i = 0; i < 3; i++) {
      const shifts = state.dm!.room!.shifts!.map((s) => s.bossId)
      expect(shifts).toHaveLength(2)
      expect(shifts).not.toContain(state.dm!.bossId)
      state = enterRoom(clearRoom(state, 'combat'), seeded(100 + i))
    }
    expect(start().dm!.room!.shifts).toEqual([])
  })

  it('a Reprieve has no fight, and declining it rolls one', () => {
    let state = start()
    state = {
      ...state,
      dm: { ...state.dm!, floorPlan: ['combat', 'reprieve', 'combat', 'combat'] },
      run: { ...state.run, room: 2 },
    }
    state = enterRoom(state, seeded(6))
    expect(state.dm?.room?.encounter).toBeNull()
    state = declineReprieve(state, seeded(7))
    expect(state.dm?.room?.encounter?.groups.length).toBeGreaterThan(0)
  })

  it('can reroll just the encounter, keeping the layout', () => {
    const state = start()
    const next = rerollEncounter(state, seeded(123))
    expect(next.dm?.room?.shape).toBe(state.dm?.room?.shape)
    expect(next.dm?.room?.terrain).toEqual(state.dm?.room?.terrain)
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
    const bossId = state.dm!.bossId
    expect(bossId).toBeTruthy()
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
    expect(state.dm?.bossId).toBe(bossId)
  })
})
