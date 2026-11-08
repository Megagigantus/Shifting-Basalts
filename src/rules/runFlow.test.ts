import { describe, expect, it } from 'vitest'
import { emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import {
  canExtract,
  clearRoom,
  defeatBoss,
  descend,
  extract,
  isBossRoom,
  makeJoinCode,
  markDead,
  newRunState,
  pass,
  runResults,
} from './runFlow'

const char = (id: string, level: number): Character => ({ ...emptyProfile(), id, name: id, level })
const twos = () => 2

function start(levels = [9, 10, 11, 12], pressures: string[] = []): RunState {
  return newRunState('r1', 'ABCD', levels.map((l, i) => char(`c${i}`, l)), pressures)
}

/** Clear a floor's 4 combat rooms and beat its boss. */
function clearFloor(state: RunState): RunState {
  for (let i = 0; i < 4; i++) state = clearRoom(state, 'combat')
  return defeatBoss(state)
}

describe('starting a run', () => {
  it('sets party level, size and multiplier from the characters', () => {
    const { run, players } = start([9, 10, 11, 12], ['brittle-ground', 'narrow-seam'])
    expect(run.partyLevel).toBe(10)
    expect(run.partySize).toBe(4)
    expect(run.entryMultiplier).toBe(1)
    expect(run.pressureBonusPercent).toBe(25)
    expect(run.floor).toBe(1)
    expect(run.room).toBe(1)
    expect(players.every((p) => p.alive && p.devotions === 0)).toBe(true)
  })

  it('needs at least one character', () => {
    expect(() => newRunState('r', 'X', [], [])).toThrow()
  })
})

describe('floor progress', () => {
  it('reaches the boss after 4 rooms, with one Devotion per room', () => {
    let state = start()
    for (let i = 0; i < 4; i++) {
      expect(isBossRoom(state)).toBe(false)
      state = clearRoom(state, 'combat')
    }
    expect(isBossRoom(state)).toBe(true)
    expect(state.players[0].devotions).toBe(4)
    expect(() => clearRoom(state, 'combat')).toThrow()
  })

  it('elite rooms pay 2 Devotions and Reprieves pay none but use up a room', () => {
    let state = start()
    state = clearRoom(state, 'elite')
    state = clearRoom(state, 'reprieve')
    expect(state.players[0].devotions).toBe(2)
    expect(state.run.room).toBe(3)
  })

  it('a boss pays Devotion and Quantum Basalts, then offers the choice', () => {
    const state = clearFloor(start())
    expect(state.run.awaitingChoice).toBe(true)
    expect(state.run.lastBossFloor).toBe(1)
    expect(state.players[0].devotions).toBe(5)
    expect(state.players[0].quantumBasaltsEarned).toBe(5)
    expect(canExtract(state)).toBe(true)
    expect(() => clearRoom(state, 'combat')).toThrow()
  })

  it('cannot beat the boss early or extract before any boss', () => {
    const state = start()
    expect(() => defeatBoss(state)).toThrow()
    expect(canExtract(state)).toBe(false)
    expect(() => extract(state)).toThrow()
  })

  it('descending moves to the next floor', () => {
    const state = descend(clearFloor(start()))
    expect(state.run.floor).toBe(2)
    expect(state.run.room).toBe(1)
    expect(state.run.awaitingChoice).toBe(false)
  })

  it('floor 5 is a single boss, and beating it is a full clear', () => {
    let state = start()
    for (let f = 1; f <= 4; f++) state = descend(clearFloor(state))
    expect(state.run.floor).toBe(5)
    expect(isBossRoom(state)).toBe(true)
    state = defeatBoss(state)
    expect(state.run.status).toBe('extracted')
    expect(state.run.lootKeptPercent).toBe(100)
    expect(state.players[0].quantumBasaltsEarned).toBe(65)
    expect(state.players[0].devotions).toBe(21)
  })
})

describe('extracting', () => {
  it('keeps loot by the last boss and pays Quantum Basalts with Pressure bonuses', () => {
    let state = start([5, 5], ['brittle-ground']) // +10%
    state = descend(clearFloor(state))
    state = clearFloor(state) // bosses 1 and 2: 5 + 8 = 13
    state = pass(state, 'c0') // +1, no bonus
    state = extract(state)
    expect(state.run.lootKeptPercent).toBe(40)
    const [a, b] = runResults(state)
    expect(a.quantumBasaltsGained).toBe(15 + 1) // ceil(14.3) + pass
    expect(b.quantumBasaltsGained).toBe(15)
    expect(a.deepestFloor).toBe(2)
    expect(a.survived).toBe(true)
  })

  it('higher entry tiers multiply boss and pass payouts', () => {
    let state = start([17, 18])
    expect(state.run.entryMultiplier).toBe(4)
    state = pass(clearFloor(state), 'c0')
    state = extract(state)
    expect(runResults(state)[0].quantumBasaltsGained).toBe(20 + 4)
  })
})

describe('death', () => {
  it('locks the character out 1d4 per floor and forfeits all but passed Basalts', () => {
    let state = clearFloor(start([5, 5]))
    state = descend(state)
    state = pass(state, 'c1')
    state = markDead(state, 'c1', twos)
    const fallen = state.players[1]
    expect(fallen.alive).toBe(false)
    expect(fallen.diedOnFloor).toBe(2)
    expect(fallen.lockoutDays).toBe(4)
    expect(() => pass(state, 'c1')).toThrow()

    // The survivor carries on and extracts; the fallen keep only passed Basalts.
    state = extract(clearFloor(state))
    const [survivor, dead] = runResults(state)
    expect(survivor.quantumBasaltsGained).toBe(13)
    expect(dead.quantumBasaltsGained).toBe(1)
    expect(dead.lockoutDays).toBe(4)
    expect(dead.deepestFloor).toBe(2)
  })

  it('the fallen stop earning Devotions and boss Basalts', () => {
    let state = markDead(start([5, 5]), 'c1', twos)
    state = clearFloor(state)
    expect(state.players[1].devotions).toBe(0)
    expect(state.players[1].quantumBasaltsEarned).toBe(0)
    expect(state.players[0].devotions).toBe(5)
  })

  it('a wipe ends the run and loses the loot', () => {
    let state = clearFloor(start([5, 5]))
    state = markDead(state, 'c0', twos)
    state = markDead(state, 'c1', twos)
    expect(state.run.status).toBe('wiped')
    expect(state.run.lootKeptPercent).toBe(0)
    expect(runResults(state).every((r) => r.quantumBasaltsGained === 0)).toBe(true)
  })
})

describe('join codes', () => {
  it('are 4 easy-to-read characters', () => {
    const code = makeJoinCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/)
  })
})
