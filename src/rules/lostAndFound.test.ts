import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { passDraft } from './draftFlow'
import { inFight, lostAndFoundLeft, returnFromMaze, vanishTiming } from './lostAndFound'
import { finishRoom } from './progress'
import { clearRoom, defeatBoss, markDead, newRunState, runResults } from './runFlow'

const char = (id: string, lostAndFound = 0): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 8,
  upgrades: lostAndFound ? { 'lost-and-found': lostAndFound } : {},
})
const twos = () => 2
const player = (state: RunState, id: string) => state.players.find((p) => p.characterId === id)!

/** A two-player run where c0 owns Lost and Found at the given rank. */
const start = (rank: number) => newRunState('r1', 'ABCD', [char('c0', rank), char('c1')], [])

/** Everyone passes their open draft. */
function passAll(state: RunState): RunState {
  for (const p of state.players) if (p.draft) state = passDraft(state, p.characterId)
  return state
}

describe('Lost and Found timing', () => {
  it('Rank 1 is once per run with next-room timing', () => {
    expect(vanishTiming({ lostAndFoundRank: 1, lostAndFoundUsed: 0 })).toBe('nextRoom')
    expect(vanishTiming({ lostAndFoundRank: 1, lostAndFoundUsed: 1 })).toBeNull()
  })

  it('Rank 2 returns at the end of the round, still once per run', () => {
    expect(vanishTiming({ lostAndFoundRank: 2, lostAndFoundUsed: 0 })).toBe('endOfRound')
    expect(vanishTiming({ lostAndFoundRank: 2, lostAndFoundUsed: 1 })).toBeNull()
  })

  it('Rank 3 works twice; the second use has Rank 1 timing', () => {
    expect(vanishTiming({ lostAndFoundRank: 3, lostAndFoundUsed: 0 })).toBe('endOfRound')
    expect(vanishTiming({ lostAndFoundRank: 3, lostAndFoundUsed: 1 })).toBe('nextRoom')
    expect(vanishTiming({ lostAndFoundRank: 3, lostAndFoundUsed: 2 })).toBeNull()
    expect(lostAndFoundLeft({ lostAndFoundRank: 3, lostAndFoundUsed: 1 })).toBe(1)
  })

  it('without the upgrade, a death expels as before', () => {
    const state = markDead(start(0), 'c0', twos)
    expect(player(state, 'c0')).toMatchObject({ alive: false, diedOnFloor: 1 })
  })
})

describe('vanishing at Rank 1', () => {
  it('misses the room\'s Devotion and draft, then reappears in the next room', () => {
    let state = markDead(start(1), 'c0', twos)
    expect(player(state, 'c0')).toMatchObject({ alive: true, vanished: 'nextRoom', lostAndFoundUsed: 1, lockoutDays: null })
    expect(inFight(player(state, 'c0'))).toBe(false)
    state = finishRoom(state, 'combat', () => 0.5)
    expect(player(state, 'c0')).toMatchObject({ devotions: 0, draft: null, vanished: null })
    expect(player(state, 'c1').devotions).toBe(1)
    expect(player(state, 'c1').draft).toBeTruthy()
  })

  it('can\'t vanish twice at Rank 1: the next death expels', () => {
    let state = markDead(start(1), 'c0', twos)
    state = passAll(finishRoom(state, 'combat', () => 0.5))
    state = markDead(state, 'c0', twos)
    expect(player(state, 'c0').alive).toBe(false)
  })

  it('in a boss room, misses the boss\'s Basalts and draft and reappears in the post-boss room', () => {
    let state = start(1)
    for (let i = 0; i < 4; i++) state = clearRoom(state, 'combat')
    state = markDead(state, 'c0', twos)
    state = finishRoom(state, 'boss', () => 0.5)
    expect(state.run.awaitingChoice).toBe(true)
    expect(player(state, 'c0')).toMatchObject({ vanished: null, draft: null })
    expect(player(state, 'c0').quantumBasaltsEarned).toBeLessThan(player(state, 'c1').quantumBasaltsEarned)
    expect(player(state, 'c0').devotions).toBe(player(state, 'c1').devotions - 1)
  })

  it('wipes the run if everyone else falls while they\'re in the maze', () => {
    let state = markDead(start(1), 'c0', twos)
    state = markDead(state, 'c1', twos)
    expect(state.run.status).toBe('wiped')
    expect(state.players.every((p) => !p.alive && p.lockoutDays !== null && !p.vanished)).toBe(true)
    expect(runResults(state).every((r) => !r.survived)).toBe(true)
  })

  it('wipes the run if the last player in the fight vanishes', () => {
    const solo = newRunState('r1', 'ABCD', [char('c0', 1)], [])
    const state = markDead(solo, 'c0', twos)
    expect(state.run.status).toBe('wiped')
    expect(player(state, 'c0').alive).toBe(false)
  })
})

describe('vanishing at Rank 2', () => {
  it('stays in the fight and comes back when the DM says', () => {
    let state = markDead(start(2), 'c0', twos)
    expect(player(state, 'c0').vanished).toBe('endOfRound')
    expect(inFight(player(state, 'c0'))).toBe(true)
    state = returnFromMaze(state, 'c0')
    expect(player(state, 'c0').vanished).toBeNull()
    expect(() => returnFromMaze(state, 'c0')).toThrow()
  })

  it('still earns the room\'s rewards, and the run doesn\'t wipe if the rest fall', () => {
    let state = markDead(start(2), 'c0', twos)
    state = markDead(state, 'c1', twos)
    expect(state.run.status).toBe('active')
    state = finishRoom(state, 'combat', () => 0.5)
    expect(player(state, 'c0')).toMatchObject({ devotions: 1, vanished: null })
  })

  it('can\'t be marked dead while in the maze', () => {
    const state = markDead(start(3), 'c0', twos)
    expect(() => markDead(state, 'c0', twos)).toThrow('maze')
  })

  it('Rank 3: the second use has next-room timing', () => {
    let state = returnFromMaze(markDead(start(3), 'c0', twos), 'c0')
    state = markDead(state, 'c0', twos)
    expect(player(state, 'c0').vanished).toBe('nextRoom')
    state = passAll(finishRoom(state, 'combat', () => 0.5))
    state = markDead(state, 'c0', twos)
    expect(player(state, 'c0').alive).toBe(false)
  })
})

describe('a defeated boss with someone in the maze', () => {
  it('leaves them alive for the post-boss room', () => {
    let state = start(1)
    for (let i = 0; i < 4; i++) state = clearRoom(state, 'combat')
    state = defeatBoss(markDead(state, 'c0', twos))
    expect(player(state, 'c0').alive).toBe(true)
  })
})
