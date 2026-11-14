// The Reprieve (design bible: Room types, and Build clarification 6): a safe
// room where each living player chooses one of:
//   Rest: a Short Rest's benefits without the hour. Applied at the table; the
//     app only records the choice.
//   Reflect: level up one boon.
//   Catch-up Basalts: only for a player with no boon that can level up.
//     1 Quantum Basalt × the entry multiplier, the same as a pass, counted as
//     passed so it's kept even on death.
// The party moves on once every living player has chosen.
import type { ReprieveRecord, RunPlayer, RunState } from '../model/run'
import { boon, levelUp, MAX_LEVEL, type Slot } from './boons'
import { passQuantumBasalts } from './run'

export type ReprieveChoice = { kind: 'rest' } | { kind: 'reflect'; slotIndex: number } | { kind: 'basalts' }

/** True while the party is in a Reprieve room (from the player-safe room view, so every device agrees). */
export function inReprieve(state: RunState): boolean {
  return state.run.status === 'active' && !state.run.awaitingChoice && state.run.roomView?.kind === 'reprieve'
}

/** This player's choice in the current Reprieve, if they've made it. */
export function currentReprieveChoice(state: RunState, player: RunPlayer): ReprieveRecord | null {
  const { floor, room } = state.run
  return player.reprieves?.find((r) => r.floor === floor && r.room === room) ?? null
}

/** Slot indexes holding a plain boon below Level 3 (what Reflect can level). */
export function reflectableSlots(slots: Slot[] | undefined): number[] {
  return (slots ?? []).flatMap((s, i) => (s?.kind === 'boon' && s.level < MAX_LEVEL ? [i] : []))
}

/** Catch-up Basalts are only for players with nothing Reflect could level. */
export function canTakeCatchUp(player: RunPlayer): boolean {
  return reflectableSlots(player.slots).length === 0
}

/** Catch-up Basalts in this run: the same as a pass. */
export function catchUpBasalts(state: RunState): number {
  return passQuantumBasalts(state.run.entryMultiplier)
}

/** Names of living players who still have to choose in the current Reprieve. */
export function reprieveWaitingOn(state: RunState): string[] {
  if (!inReprieve(state)) return []
  return state.players.filter((p) => p.alive && !currentReprieveChoice(state, p)).map((p) => p.name)
}

/** Record one player's Reprieve choice, or throw if it isn't allowed. */
export function chooseReprieve(state: RunState, characterId: string, choice: ReprieveChoice): RunState {
  if (!inReprieve(state)) throw new Error('The party isn\'t in a Reprieve.')
  const player = state.players.find((p) => p.characterId === characterId)
  if (!player) throw new Error('That character isn\'t in this run.')
  if (!player.alive) throw new Error(`${player.name} has fallen.`)
  if (currentReprieveChoice(state, player)) throw new Error(`${player.name} has already chosen in this Reprieve.`)

  const { floor, room } = state.run
  let updated: RunPlayer
  if (choice.kind === 'rest') {
    updated = { ...player, reprieves: [...(player.reprieves ?? []), { floor, room, choice: 'rest' }] }
  } else if (choice.kind === 'reflect') {
    if (!reflectableSlots(player.slots).includes(choice.slotIndex)) throw new Error('Reflect levels up a boon below Level 3.')
    const slots = levelUp(player.slots ?? [], choice.slotIndex)
    const leveled = slots[choice.slotIndex]
    if (leveled?.kind !== 'boon') throw new Error('Reflect levels up a boon below Level 3.')
    updated = {
      ...player,
      slots,
      reprieves: [...(player.reprieves ?? []), { floor, room, choice: 'reflect', boonId: leveled.boonId, level: leveled.level }],
    }
  } else {
    if (!canTakeCatchUp(player)) throw new Error('Catch-up Basalts are only for players with no boon to level up.')
    const basalts = catchUpBasalts(state)
    updated = {
      ...player,
      quantumBasaltsPassed: player.quantumBasaltsPassed + basalts,
      reprieves: [...(player.reprieves ?? []), { floor, room, choice: 'basalts', basalts }],
    }
  }
  return { ...state, players: state.players.map((p) => (p.characterId === characterId ? updated : p)) }
}

/** A short line for a record, e.g. "Reflected: Iron Root to Level 2". */
export function describeReprieve(r: ReprieveRecord): string {
  if (r.choice === 'rest') return 'Rested'
  if (r.choice === 'reflect') return `Reflected: ${r.boonId ? boon(r.boonId).name : 'a boon'} to Level ${r.level ?? '?'}`
  return `Took ${r.basalts ?? 0} catch-up Quantum Basalt${r.basalts === 1 ? '' : 's'}`
}
