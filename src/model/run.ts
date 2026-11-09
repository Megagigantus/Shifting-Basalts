// A run in progress, as saved in Firestore:
//   runs/{runId}                    -> Run (minus id)
//   runs/{runId}/players/{charId}   -> RunPlayer
// Hidden information (runs/{runId}/dmOnly) arrives with the room generator.
import type { Slot } from '../rules/boons'
import type { DraftCharacter, Offer } from '../rules/draft'

/** A player's open draft. */
export interface DraftOffer {
  floor: number
  room: number
  elite: boolean
  offers: Offer[]
}

/** A hidden offer: Thils's gifts (room condition met) and/or the class hidden boon. */
export interface HiddenOffer {
  gifts: string[]
  classBoon: string | null
}

export type RunStatus = 'active' | 'extracted' | 'wiped'
export type RoomKind = 'combat' | 'elite' | 'reprieve' | 'boss'

export interface RoomLogEntry {
  floor: number
  room: number
  kind: RoomKind
}

export interface Run {
  id: string
  /** Short code players will use to find the run (Phase 2). */
  joinCode: string
  status: RunStatus
  characterIds: string[]
  partyLevel: number
  partySize: number
  entryMultiplier: number
  pressures: string[]
  pressureBonusPercent: number
  /** +5% per Extra Pressures owner in the party, captured at run start. */
  extraPressuresBonusPercent?: number
  /** Extra loot share kept from Deep Pockets (highest rank in the party). */
  deepPocketsPercent?: number
  floor: number
  /** The room being played: 1..rooms on the floor, then rooms + 1 is the boss. */
  room: number
  /** True after a boss on floors 1 to 4, until the party descends or extracts. */
  awaitingChoice: boolean
  /** Highest floor whose boss was beaten (0 = none yet). */
  lastBossFloor: number
  log: RoomLogEntry[]
  /** Set when the run ends. */
  lootKeptPercent: number | null
}

export interface RunPlayer {
  characterId: string
  name: string
  alive: boolean
  /** Boss Quantum Basalts banked this run, before Pressure bonuses. Lost on death. */
  quantumBasaltsEarned: number
  /** Quantum Basalts from passing. Kept even on death. */
  quantumBasaltsPassed: number
  passes: number
  devotions: number
  /** This player's Extra Loot bonus on boss Quantum Basalts, captured at run start. */
  extraLootBonusPercent?: number
  /** Days this player's Quick Return takes off a death lockout. */
  quickReturnDays?: number
  /** Boon slots (3 plus Extra Boon Slot ranks). Boons reset every run. */
  slots?: Slot[]
  /** The hidden boon slot: a class hidden boon or one of Thils's gifts. */
  hiddenBoonId?: string | null
  /** What the draft needs to know about the character, captured at run start. */
  draftProfile?: DraftCharacter & {
    /** Offer rerolls allowed per floor (Reroll upgrade rank). */
    rerollsPerFloor: number
    /** Attunement: tag the first offer of the run includes, if set. */
    attuneTag?: string | null
  }
  /** The open draft offer, until the player chooses. */
  draft?: DraftOffer | null
  /** A hidden offer (room condition or class trigger), until the player chooses. */
  hiddenOffer?: HiddenOffer | null
  /** Rerolls used on this floor. */
  rerolls?: { floor: number; used: number }
  /** How many drafts this player has had this run (the first gets Attunement). */
  draftsSeen?: number
  diedOnFloor: number | null
  lockoutDays: number | null
  lockoutRolls: number[] | null
}

export interface RunState {
  run: Run
  players: RunPlayer[]
}

/** What a run adds to each character's permanent record when it ends. */
export interface RunResult {
  characterId: string
  name: string
  survived: boolean
  quantumBasaltsGained: number
  devotions: number
  deepestFloor: number
  lockoutDays: number | null
}
