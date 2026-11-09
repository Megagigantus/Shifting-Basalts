// Rooms during a run: planning floors, entering rooms, reveals, declining a
// Reprieve and Hidden Sight. Like the other flows, every function returns a
// new state or throws. The DM-only part lives in state.dm; the player view is
// state.run.roomView.
import type { RunState } from '../model/run'
import type { Random } from './draft'
import { conditionOf, generateRoom, planFloor, playerView, type Room } from './rooms'
import { floorInfo } from './run'
import { isBossRoom } from './runFlow'

function withRoom(state: RunState, room: Room | null, floorPlan = state.dm?.floorPlan ?? []): RunState {
  return {
    ...state,
    run: { ...state.run, roomView: room ? playerView(room) : null },
    dm: { floorPlan, room },
  }
}

/** Generate the room the party is now in (or none in the post-boss room). */
export function enterRoom(state: RunState, random: Random): RunState {
  const { run } = state
  if (run.status !== 'active' || run.awaitingChoice) return withRoom(state, null)
  if (isBossRoom(state)) return withRoom(state, generateRoom(run.floor, run.room, 'boss', random))
  const kind = state.dm?.floorPlan[run.room - 1] ?? 'combat'
  return withRoom(state, generateRoom(run.floor, run.room, kind, random))
}

/** Plan the current floor (elites and the Reprieve), then enter its first room. */
export function startFloor(state: RunState, random: Random): RunState {
  const ranks = state.players.filter((p) => p.alive).map((p) => p.reprieveRank ?? 0)
  const plan = planFloor(state.run.floor, floorInfo(state.run.floor).rooms, ranks, random)
  return enterRoom({ ...state, dm: { floorPlan: plan, room: null } }, random)
}

export type RevealTarget = 'trueExit' | 'falseWall' | 'oddity' | 'condition' | { trick: string }

/** Show players one hidden part of the current room. */
export function reveal(state: RunState, target: RevealTarget): RunState {
  const room = state.dm?.room
  if (!room) throw new Error('There\'s no room to reveal anything in.')
  const next: Room =
    typeof target === 'object'
      ? { ...room, tricks: room.tricks.map((t) => (t.id === target.trick ? { ...t, revealed: true } : t)) }
      : { ...room, revealed: { ...room.revealed, [target]: true } }
  return withRoom(state, next)
}

/** The party turns down the Reprieve and fights that room instead. */
export function declineReprieve(state: RunState, random: Random): RunState {
  const room = state.dm?.room
  if (!room || room.kind !== 'reprieve') throw new Error('This room isn\'t a Reprieve.')
  const plan = [...(state.dm?.floorPlan ?? [])]
  plan[state.run.room - 1] = 'combat'
  return withRoom(state, generateRoom(state.run.floor, state.run.room, 'combat', random), plan)
}

/** Roll the current room again (a DM convenience). */
export function rerollRoom(state: RunState, random: Random): RunState {
  return enterRoom(state, random)
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
