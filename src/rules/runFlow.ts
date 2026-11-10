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
  partyLevel,
  passQuantumBasalts,
  pressureBonusPercent,
  rollLockoutDays,
  withPressureBonus,
} from './run'
import { emptySlots, hiddenBoon, slotCount, type Slot } from './boons'
import { keptPercent, partyRewardBonusPercent, planShare, type LootItem, type LootPick } from './loot'
import { relicStateFor, vaultPending } from './vault'
import {
  deepPocketsPercent,
  extraLootBonusPercent,
  extraPressuresBonusPercent,
  quickReturnDays,
  shortenedLockout,
} from './upgrades'

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
      extraPressuresBonusPercent: extraPressuresBonusPercent(party),
      deepPocketsPercent: deepPocketsPercent(party),
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
      level: c.level,
      alive: true,
      quantumBasaltsEarned: 0,
      quantumBasaltsPassed: 0,
      passes: 0,
      devotions: 0,
      extraLootBonusPercent: extraLootBonusPercent(c),
      quickReturnDays: quickReturnDays(c),
      slots: emptySlots(slotCount(c.upgrades['extra-boon-slot'] ?? 0)),
      hiddenBoonId: null,
      draftProfile: draftProfileFor(c),
      draft: null,
      hiddenOffer: null,
      draftsSeen: 0,
      forgeOwner: (c.upgrades.forge ?? 0) > 0,
      reprieveRank: c.upgrades.reprieve ?? 0,
      hiddenSight: (c.upgrades['hidden-sight'] ?? 0) > 0,
      hiddenSightFloor: null,
      relicsOwned: (c.loot ?? []).filter((i) => i.kind === 'relic').map((i) => i.ref),
      diedOnFloor: null,
      lockoutDays: null,
      lockoutRolls: null,
    })),
  }
}

function requireActive(state: RunState) {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
}

/** The draft details a run keeps for a character, captured at run start. */
export function draftProfileFor(c: Character): NonNullable<RunPlayer['draftProfile']> {
  return {
    classId: c.classId,
    casterType: c.casterType,
    hasSummon: c.hasSummon,
    trackDevotions: { ...c.trackDevotions },
    banished: [...(c.banished ?? [])],
    favoredTags: [...(c.favoredTags ?? [])],
    rerollsPerFloor: c.upgrades.reroll ?? 0,
    attuneTag: (c.upgrades.attunement ?? 0) > 0 ? (c.attuneTag ?? null) : null,
  }
}

/** True while any living player still has a draft to choose from. */
export function draftsPending({ players }: RunState): boolean {
  return players.some((p) => p.alive && p.draft)
}

/** Living players still choosing their draft, by name. */
export function waitingOn({ players }: RunState): string[] {
  return players.filter((p) => p.alive && p.draft).map((p) => p.name)
}

function requireNoDrafts(state: RunState) {
  if (draftsPending(state)) throw new Error(`Waiting on draft picks from ${waitingOn(state).join(', ')}.`)
}

function awardDevotions(players: RunPlayer[], amount: number): RunPlayer[] {
  return players.map((p) => (p.alive ? { ...p, devotions: p.devotions + amount } : p))
}

/** Clear a non-boss room as combat, elite or Reprieve. */
export function clearRoom(state: RunState, kind: Exclude<RoomKind, 'boss'>): RunState {
  requireActive(state)
  requireNoDrafts(state)
  if (state.run.awaitingChoice) throw new Error('Choose to descend or extract first.')
  if (isBossRoom(state)) throw new Error('This is the boss room.')
  const { run } = state
  return {
    ...state,
    run: { ...run, room: run.room + 1, log: [...run.log, { floor: run.floor, room: run.room, kind }] },
    players: awardDevotions(state.players, devotionsForRoom(kind)),
  }
}

/** Beat the floor's boss: Devotions plus the boss's Quantum Basalts for everyone alive. */
export function defeatBoss(state: RunState): RunState {
  requireActive(state)
  requireNoDrafts(state)
  if (!isBossRoom(state)) throw new Error('Clear the floor\'s rooms first.')
  const { run } = state
  const payout = bossQuantumBasalts(run.floor, run.entryMultiplier)
  const players = awardDevotions(state.players, devotionsForRoom('boss')).map((p) =>
    p.alive ? { ...p, quantumBasaltsEarned: p.quantumBasaltsEarned + payout } : p,
  )
  const next: RunState = {
    ...state,
    run: {
      ...run,
      lastBossFloor: run.floor,
      // The post-boss room's Forge: one use per living owner (none after the final boss).
      forgeUsesLeft: run.floor < LAST_FLOOR ? players.filter((p) => p.alive && p.forgeOwner).length : 0,
      awaitingChoice: true,
      log: [...run.log, { floor: run.floor, room: run.room, kind: 'boss' }],
    },
    players,
  }
  // Beating the legendary boss is a full clear: Thils's Vault opens (rules/vault.ts),
  // then the party extracts with all its loot.
  return next
}

/** True after the legendary boss: the run ends with extraction once the Vault is done. */
export const isFullClear = ({ run }: RunState) => run.lastBossFloor >= LAST_FLOOR

export function descend(state: RunState): RunState {
  requireActive(state)
  requireNoDrafts(state)
  if (!state.run.awaitingChoice) throw new Error('You can only descend after a boss.')
  if (state.run.floor >= LAST_FLOOR) throw new Error('There is no deeper floor.')
  return { ...state, run: { ...state.run, floor: state.run.floor + 1, room: 1, awaitingChoice: false, forgeUsesLeft: 0 } }
}

/**
 * Leave the Basalts after a boss. `picks`: the items the party keeps and who
 * gets each (any character in the run, fallen ones too); the rest of the kept
 * value is paid out in credits.
 */
export function extract(state: RunState, picks: LootPick[] = []): RunState {
  if (!canExtract(state)) throw new Error('You can only extract after beating a boss.')
  if (vaultPending(state)) throw new Error('Every survivor takes a relic from Thils\'s Vault first.')
  const lootShare = planShare(state, picks)
  return {
    ...state,
    run: {
      ...state.run,
      status: 'extracted',
      awaitingChoice: false,
      lootKeptPercent: lootShare.keptPercent,
      lootShare,
    },
  }
}

/** Loot share kept if the party extracts now: floor share, Deep Pockets and Collector's Eye (capped at 100%). */
export function lootKeptIfExtracting(state: RunState): number {
  return keptPercent(state)
}

/**
 * A player's total bonus on Quantum Basalts (boss and loot): the party reward
 * bonus (Pressures + Extra Pressures owners) plus their own Extra Loot.
 */
export function rewardBonusPercent(state: RunState, player: RunPlayer): number {
  return partyRewardBonusPercent(state.run) + (player.extraLootBonusPercent ?? 0)
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

function updatePlayer(state: RunState, characterId: string, change: (p: RunPlayer) => RunPlayer): RunState {
  requireActive(state)
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.characterId !== characterId) return p
      if (!p.alive) throw new Error(`${p.name} has fallen.`)
      return change(p)
    }),
  }
}

/** Apply a boon-slot change (from rules/boons.ts) to one living player. */
export function changeSlots(state: RunState, characterId: string, change: (slots: Slot[]) => Slot[]): RunState {
  return updatePlayer(state, characterId, (p) => ({ ...p, slots: change(p.slots ?? []) }))
}

/** Put a hidden boon in a player's hidden slot (replacing any held one), or clear it with null. */
export function setHiddenBoon(state: RunState, characterId: string, hiddenBoonId: string | null): RunState {
  if (hiddenBoonId) hiddenBoon(hiddenBoonId) // throws if unknown
  return updatePlayer(state, characterId, (p) => ({ ...p, hiddenBoonId }))
}

/** A character dies: expelled, locked out, and the run wipes if nobody is left. */
export function markDead(state: RunState, characterId: string, roll?: Roll): RunState {
  requireActive(state)
  const floor = state.run.floor
  const players = state.players.map((p) => {
    if (p.characterId !== characterId) return p
    if (!p.alive) throw new Error(`${p.name} has already fallen.`)
    const lockout = rollLockoutDays(floor, roll)
    return {
      ...p,
      alive: false,
      diedOnFloor: floor,
      lockoutDays: shortenedLockout(lockout.days, p.quickReturnDays ?? 0),
      lockoutRolls: lockout.rolls,
    }
  })
  const wiped = players.every((p) => !p.alive)
  return {
    ...state,
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
  const pool = run.loot?.items ?? []
  return state.players.map((p) => {
    const keepsEarned = p.alive && run.status === 'extracted'
    const loot: LootItem[] =
      run.status === 'extracted'
        ? (run.lootShare?.picks ?? [])
            .filter((pick) => pick.characterId === p.characterId)
            .map((pick) => pool.find((i) => i.uid === pick.uid))
            .filter((i): i is LootItem => Boolean(i))
        : []
    if (run.status === 'extracted' && p.alive && p.vaultRelic) {
      loot.push({
        uid: `relic-${p.vaultRelic}`,
        kind: 'relic',
        ref: p.vaultRelic,
        rarity: null,
        floor: LAST_FLOOR,
        room: 1,
        source: 'vault',
        relicState: relicStateFor(run.partyLevel),
      })
    }
    return {
      loot,
      characterId: p.characterId,
      name: p.name,
      survived: p.alive,
      quantumBasaltsGained:
        (keepsEarned ? withPressureBonus(p.quantumBasaltsEarned, rewardBonusPercent(state, p)) : 0) +
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
