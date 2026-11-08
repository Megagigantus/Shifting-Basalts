// How a run moves forward. Each function takes the current run state and
// returns a new one (it never changes the old one), or throws if the action
// isn't allowed right now. Screens call these, then save the result.
import type { Character } from '../model/character'
import type { RoomKind, RunPlayer, RunResult, RunState } from '../model/run'
import {
  bossQuantumBasalts,
  devotionsForRoom,
  entryMultiplier,
  floorInfo,
  LAST_FLOOR,
  lootKeptPercent,
  partyLevel,
  passQuantumBasalts,
  pressureBonusPercent,
  rollLockoutDays,
  withPressureBonus,
} from './run'

type Roll = (sides: number) => number

export function isBossRoom({ run }: RunState): boolean {
  return run.room > floorInfo(run.floor).rooms
}

export function canExtract({ run }: RunState): boolean {
  return run.status === 'active' && run.awaitingChoice && run.lastBossFloor >= 1
}

export function newRunState(id: string, joinCode: string, party: Character[], pressures: string[]): RunState {
  if (party.length === 0) throw new Error('Pick at least one character.')
  const level = partyLevel(party.map((c) => c.level))
  return {
    run: {
      id,
      joinCode,
      status: 'active',
      characterIds: party.map((c) => c.id),
      partyLevel: level,
      partySize: party.length,
      entryMultiplier: entryMultiplier(level),
      pressures,
      pressureBonusPercent: pressureBonusPercent(pressures),
      floor: 1,
      room: 1,
      awaitingChoice: false,
      lastBossFloor: 0,
      log: [],
      lootKeptPercent: null,
    },
    players: party.map((c) => ({
      characterId: c.id,
      name: c.name,
      alive: true,
      quantumBasaltsEarned: 0,
      quantumBasaltsPassed: 0,
      passes: 0,
      devotions: 0,
      diedOnFloor: null,
      lockoutDays: null,
      lockoutRolls: null,
    })),
  }
}

function requireActive(state: RunState) {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
}

function awardDevotions(players: RunPlayer[], amount: number): RunPlayer[] {
  return players.map((p) => (p.alive ? { ...p, devotions: p.devotions + amount } : p))
}

/** Clear a non-boss room as combat, elite or Reprieve. */
export function clearRoom(state: RunState, kind: Exclude<RoomKind, 'boss'>): RunState {
  requireActive(state)
  if (state.run.awaitingChoice) throw new Error('Choose to descend or extract first.')
  if (isBossRoom(state)) throw new Error('This is the boss room.')
  const { run } = state
  return {
    run: { ...run, room: run.room + 1, log: [...run.log, { floor: run.floor, room: run.room, kind }] },
    players: awardDevotions(state.players, devotionsForRoom(kind)),
  }
}

/** Beat the floor's boss: Devotions plus the boss's Quantum Basalts for everyone alive. */
export function defeatBoss(state: RunState): RunState {
  requireActive(state)
  if (!isBossRoom(state)) throw new Error('Clear the floor\'s rooms first.')
  const { run } = state
  const payout = bossQuantumBasalts(run.floor, run.entryMultiplier)
  const players = awardDevotions(state.players, devotionsForRoom('boss')).map((p) =>
    p.alive ? { ...p, quantumBasaltsEarned: p.quantumBasaltsEarned + payout } : p,
  )
  const next: RunState = {
    run: {
      ...run,
      lastBossFloor: run.floor,
      awaitingChoice: true,
      log: [...run.log, { floor: run.floor, room: run.room, kind: 'boss' }],
    },
    players,
  }
  // Beating the legendary boss is a full clear: the run ends there.
  return run.floor >= LAST_FLOOR ? extract(next) : next
}

export function descend(state: RunState): RunState {
  requireActive(state)
  if (!state.run.awaitingChoice) throw new Error('You can only descend after a boss.')
  if (state.run.floor >= LAST_FLOOR) throw new Error('There is no deeper floor.')
  return { ...state, run: { ...state.run, floor: state.run.floor + 1, room: 1, awaitingChoice: false } }
}

export function extract(state: RunState): RunState {
  if (!canExtract(state)) throw new Error('You can only extract after beating a boss.')
  return {
    ...state,
    run: {
      ...state.run,
      status: 'extracted',
      awaitingChoice: false,
      lootKeptPercent: lootKeptPercent(state.run.lastBossFloor),
    },
  }
}

/** A player passes a draft for Quantum Basalts that survive even death. */
export function pass(state: RunState, characterId: string): RunState {
  requireActive(state)
  const multiplier = state.run.entryMultiplier
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.characterId !== characterId) return p
      if (!p.alive) throw new Error(`${p.name} has fallen.`)
      return {
        ...p,
        passes: p.passes + 1,
        quantumBasaltsPassed: p.quantumBasaltsPassed + passQuantumBasalts(multiplier),
      }
    }),
  }
}

/** A character dies: expelled, locked out, and the run wipes if nobody is left. */
export function markDead(state: RunState, characterId: string, roll?: Roll): RunState {
  requireActive(state)
  const floor = state.run.floor
  const players = state.players.map((p) => {
    if (p.characterId !== characterId) return p
    if (!p.alive) throw new Error(`${p.name} has already fallen.`)
    const lockout = rollLockoutDays(floor, roll)
    return { ...p, alive: false, diedOnFloor: floor, lockoutDays: lockout.days, lockoutRolls: lockout.rolls }
  })
  const wiped = players.every((p) => !p.alive)
  return {
    players,
    run: wiped
      ? { ...state.run, status: 'wiped', awaitingChoice: false, lootKeptPercent: 0 }
      : state.run,
  }
}

/** What each character takes away once the run has ended. */
export function runResults(state: RunState): RunResult[] {
  const { run } = state
  if (run.status === 'active') throw new Error('The run is still going.')
  return state.players.map((p) => {
    const keepsEarned = p.alive && run.status === 'extracted'
    return {
      characterId: p.characterId,
      name: p.name,
      survived: p.alive,
      quantumBasaltsGained:
        (keepsEarned ? withPressureBonus(p.quantumBasaltsEarned, run.pressureBonusPercent) : 0) +
        p.quantumBasaltsPassed,
      devotions: p.devotions,
      deepestFloor: p.diedOnFloor ?? run.floor,
      lockoutDays: p.lockoutDays,
    }
  })
}

/** A short, readable code like "K7QX" (no 0/O or 1/I to avoid mix-ups). */
export function makeJoinCode(random: () => number = Math.random): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => letters[Math.floor(random() * letters.length)]).join('')
}
