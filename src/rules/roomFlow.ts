// Rooms during a run: planning floors, entering rooms, reveals, declining a
// Reprieve and Hidden Sight. Like the other flows, every function returns a
// new state or throws. The DM-only part lives in state.dm; the player view is
// state.run.roomView.
import type { RunState } from '../model/run'
import type { Random } from './draft'
import { conditionOf, generateRoom, planFloor, playerView, type Room } from './rooms'
import { floorInfo } from './run'
import { isBossRoom } from './runFlow'
import { generateEncounter } from './encounters'
import { pickBoss, restlessShiftActions } from './bosses'
import { applyHp, emptyHp, hpShown, hpTrackers } from './hp'

function withRoom(state: RunState, room: Room | null, floorPlan = state.dm?.floorPlan ?? []): RunState {
  // Refresh the Bloodied facts players may see before building their view.
  const ctx = { partyLevel: state.run.partyLevel, pressures: state.run.pressures }
  const full = room ? { ...room, hp: room.hp ?? emptyHp(), hpShown: hpShown(room, ctx) } : null
  return {
    ...state,
    run: { ...state.run, roomView: full ? playerView(full) : null },
    dm: { ...state.dm, floorPlan, room: full },
  }
}

/** Restless Stone sets how many Shift Actions a non-boss room gets. */
function restlessCount(pressures: string[]): number {
  if (pressures.includes('restless-stone-2')) return 2
  if (pressures.includes('restless-stone')) return 1
  return 0
}

/** Add the fight to a freshly rolled room: an encounter, or the floor's boss. */
function populate(state: RunState, room: Room, random: Random): Room {
  const { run } = state
  const living = state.players.filter((p) => p.alive)
  // A new fight starts unhurt.
  room = { ...room, hp: emptyHp() }
  if (room.kind === 'reprieve') return { ...room, encounter: null, boss: null, shifts: [] }
  if (room.kind === 'boss') {
    const id = state.dm?.bossId ?? pickBoss(run.floor, random)
    return {
      ...room,
      encounter: null,
      boss: { id, partySize: living.length },
      shifts: [{ bossId: id, revealed: false }],
    }
  }
  const levels = living.map((p) => p.level ?? run.partyLevel)
  const encounter = generateEncounter(run.floor, room.kind === 'elite', levels, run.partyLevel, random)
  const shifts = restlessShiftActions(run.floor, state.dm?.bossId ?? null, restlessCount(run.pressures), random)
  return { ...room, encounter, boss: null, shifts: shifts.map((bossId) => ({ bossId, revealed: false })) }
}

function rollRoom(state: RunState, kind: Room['kind'], random: Random): Room {
  return populate(state, generateRoom(state.run.floor, state.run.room, kind, random), random)
}

/** Generate the room the party is now in (or none in the post-boss room). */
export function enterRoom(state: RunState, random: Random): RunState {
  const { run } = state
  if (run.status !== 'active' || run.awaitingChoice) return withRoom(state, null)
  if (isBossRoom(state)) {
    // Runs started before bosses were picked per floor get one now.
    const withBoss = state.dm?.bossId ? state : { ...state, dm: { floorPlan: [], room: null, ...state.dm, bossId: pickBoss(run.floor, random) } }
    return withRoom(withBoss, rollRoom(withBoss, 'boss', random))
  }
  const kind = state.dm?.floorPlan[run.room - 1] ?? 'combat'
  return withRoom(state, rollRoom(state, kind, random))
}

/** Plan the current floor (elites, the Reprieve and its boss), then enter its first room. */
export function startFloor(state: RunState, random: Random): RunState {
  const ranks = state.players.filter((p) => p.alive).map((p) => p.reprieveRank ?? 0)
  const plan = planFloor(state.run.floor, floorInfo(state.run.floor).rooms, ranks, random)
  const bossId = pickBoss(state.run.floor, random)
  return enterRoom({ ...state, dm: { floorPlan: plan, room: null, bossId } }, random)
}

/** Swap the floor's boss for another of its three (and rebuild the boss room if the party is in it). */
export function rerollBoss(state: RunState, random: Random): RunState {
  const bossId = pickBoss(state.run.floor, random, state.dm?.bossId ?? null)
  const next: RunState = { ...state, dm: { floorPlan: [], room: null, ...state.dm, bossId } }
  const room = next.dm?.room
  if (room?.kind === 'boss') {
    return withRoom(next, {
      ...room,
      boss: { id: bossId, partySize: room.boss?.partySize ?? 0 },
      shifts: [{ bossId, revealed: false }],
      hp: emptyHp(),
    })
  }
  return next
}

export type RevealTarget =
  | 'trueExit'
  | 'falseWall'
  | 'oddity'
  | 'condition'
  | 'enemies'
  | { trick: string }
  | { enemy: number }
  | { shift: string }

/** Show players one hidden part of the current room. */
export function reveal(state: RunState, target: RevealTarget): RunState {
  const room = state.dm?.room
  if (!room) throw new Error('There\'s no room to reveal anything in.')
  let next: Room
  if (target === 'enemies' || (typeof target === 'object' && 'enemy' in target)) {
    if (!room.encounter) throw new Error('This room has no enemies to reveal.')
    const groups = room.encounter.groups.map((g, i) =>
      target === 'enemies' || i === target.enemy ? { ...g, revealed: true } : g,
    )
    next = { ...room, encounter: { ...room.encounter, groups } }
  } else if (typeof target === 'object' && 'shift' in target) {
    next = { ...room, shifts: (room.shifts ?? []).map((s) => (s.bossId === target.shift ? { ...s, revealed: true } : s)) }
  } else if (typeof target === 'object') {
    next = { ...room, tricks: room.tricks.map((t) => (t.id === target.trick ? { ...t, revealed: true } : t)) }
  } else {
    next = { ...room, revealed: { ...room.revealed, [target]: true } }
  }
  return withRoom(state, next)
}

/**
 * Damage (positive) or heal (negative) one HP tracker in the current room.
 * `key` comes from hpTrackers (e.g. "enemy:0:1", "boss", "part:Hound:0").
 */
export function changeHp(state: RunState, key: string, amount: number): RunState {
  const room = state.dm?.room
  if (!room) throw new Error('There\'s no room to track HP in.')
  const ctx = { partyLevel: state.run.partyLevel, pressures: state.run.pressures }
  const t = hpTrackers(room, ctx).find((x) => x.key === key)
  if (!t) throw new Error('That creature isn\'t in this room.')
  if (!Number.isFinite(amount) || amount === 0) return state
  return withRoom(state, { ...room, hp: applyHp(room.hp, key, t.max, amount) })
}

/** The DM's Bloodied button for the boss: true or false by hand, or null to follow its HP. */
export function setBossBloodied(state: RunState, value: boolean | null): RunState {
  const room = state.dm?.room
  if (!room?.boss) throw new Error('There\'s no boss in this room.')
  return withRoom(state, { ...room, hp: { ...(room.hp ?? emptyHp()), bossBloodied: value } })
}

/** The party turns down the Reprieve and fights that room instead. */
export function declineReprieve(state: RunState, random: Random): RunState {
  const room = state.dm?.room
  if (!room || room.kind !== 'reprieve') throw new Error('This room isn\'t a Reprieve.')
  const plan = [...(state.dm?.floorPlan ?? [])]
  plan[state.run.room - 1] = 'combat'
  return withRoom(state, rollRoom(state, 'combat', random), plan)
}

/** Roll the current room again (a DM convenience). */
export function rerollRoom(state: RunState, random: Random): RunState {
  return enterRoom(state, random)
}

/** Roll only the current room's encounter again, keeping the layout. */
export function rerollEncounter(state: RunState, random: Random): RunState {
  const room = state.dm?.room
  if (!room || (room.kind !== 'combat' && room.kind !== 'elite')) throw new Error('This room has no encounter to reroll.')
  return withRoom(state, populate(state, room, random))
}

/**
 * A Hidden Sight owner uses their once-per-floor hint on the current room.
 * Returns the new state and the hint, which goes only to that player.
 */
export function spendHiddenSight(state: RunState, characterId: string): { state: RunState; hint: string } {
  const player = state.players.find((p) => p.characterId === characterId)
  if (!player) throw new Error('That character isn\'t in this run.')
  if (!player.alive) throw new Error(`${player.name} has fallen.`)
  if (!player.hiddenSight) throw new Error(`${player.name} doesn't have Hidden Sight.`)
  if (player.hiddenSightFloor === state.run.floor) throw new Error('Hidden Sight is already used on this floor.')
  const room = state.dm?.room
  if (!room || room.condition === null) throw new Error('This room has no secret condition to hint at.')
  return {
    hint: conditionOf(room.condition).hint,
    state: {
      ...state,
      players: state.players.map((p) => (p.characterId === characterId ? { ...p, hiddenSightFloor: state.run.floor } : p)),
    },
  }
}
