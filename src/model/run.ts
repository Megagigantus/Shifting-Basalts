// A run in progress, as saved in Firestore:
//   runs/{runId}                    -> Run (minus id)
//   runs/{runId}/players/{charId}   -> RunPlayer
// Hidden information (runs/{runId}/dmOnly) arrives with the room generator.
import type { Slot } from '../rules/boons'
import type { DraftCharacter, Offer } from '../rules/draft'
import type { Room, RoomView } from '../rules/rooms'
import type { LootItem, LootShare, RunLoot } from '../rules/loot'

/** A player's open draft. */
export interface DraftOffer {
  floor: number
  room: number
  elite: boolean
  offers: Offer[]
  /** The Starting Boon offer before room 1, rather than a room's draft. */
  starting?: boolean
}

/** A hidden offer: Thils's gifts (room condition met) and/or the class hidden boon. */
export interface HiddenOffer {
  gifts: string[]
  classBoon: string | null
}

export type RunStatus = 'active' | 'extracted' | 'wiped'
export type RoomKind = 'combat' | 'elite' | 'reprieve' | 'boss'

/**
 * One player's choice in one Reprieve: Rest (logged; applied at the table),
 * Reflect (a boon leveled up), or catch-up Basalts (when no boon could level).
 */
export interface ReprieveRecord {
  floor: number
  room: number
  choice: 'rest' | 'reflect' | 'basalts'
  /** Reflect: the boon that leveled up, and its new level. */
  boonId?: string
  level?: number
  /** Catch-up Basalts: how many (counted as passed, so kept on death). */
  basalts?: number
}

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
  /** Forge uses left in this post-boss room (one per living owner); 0 once it cools. */
  forgeUsesLeft?: number
  /** What players may see of the current room (null in the post-boss room). */
  roomView?: RoomView | null
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
  /** The party's shared run loot (items and credits). Lost on a wipe. */
  loot?: RunLoot
  /** What the party kept on extraction: items picked and assigned, plus the credits payout. */
  lootShare?: LootShare | null
  /** Thils's Vault is open (after the floor 5 boss, before the run ends). */
  vaultOpen?: boolean
  /** The DM has opened the extraction share: players are asked to request loot and tap Done. */
  lootCall?: boolean
}

export interface RunPlayer {
  characterId: string
  name: string
  /** Character level at run start (sets this player's share of each XP budget). */
  level?: number
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
  /** Lost and Found rank (captured at run start) and uses spent this run (rules/lostAndFound.ts). */
  lostAndFoundRank?: number
  lostAndFoundUsed?: number
  /**
   * Vanished into the maze instead of being expelled: "nextRoom" misses the
   * rest of the fight and reappears in the next room; "endOfRound" returns
   * when the DM says. Null or missing when present.
   */
  vanished?: 'nextRoom' | 'endOfRound' | null
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
  /** Weapon and armor training and mastery picks, captured at run start, for aiming gear drops. */
  training?: { weapons: string[]; armor: string[]; masteries: string[] }
  /** The room ("floor-room") where this player's class trigger last fired; once per room. */
  classTriggerRoom?: string
  /** Rerolls used on this floor. */
  rerolls?: { floor: number; used: number }
  /** How many drafts this player has had this run (the first gets Attunement). */
  draftsSeen?: number
  /** Owns the Forge upgrade (adds one Forge use after each boss). */
  forgeOwner?: boolean
  /** Reprieve upgrade rank (each owner rolls for a Reprieve when a floor starts). */
  reprieveRank?: number
  /** What this player chose in each Reprieve this run (rules/reprieve.ts). */
  reprieves?: ReprieveRecord[]
  /** Owns Hidden Sight (one hint per floor). */
  hiddenSight?: boolean
  /** The floor Hidden Sight was last used on. */
  hiddenSightFloor?: number | null
  /** Recovery points left per recovery track id (rules/recovery.ts); refreshed at each clear that pays a Devotion. */
  recoveryPoints?: Record<string, number> | null
  /** Boon counters the DM keeps, e.g. "Banked echoes" -> 2. */
  counters?: Record<string, number>
  /** Owns the Healing Font upgrade (each owner beyond the first adds temp HP). */
  healingFontOwner?: boolean
  /** Owns the Reclamation Shrine (it stands in post-boss rooms if anyone does; rules/shrine.ts). */
  shrineOwner?: boolean
  /** Relics this character already owns (captured at run start; never offered again). */
  relicsOwned?: string[]
  /** Thils's Vault: the relics offered, until the player takes one. */
  vaultOffer?: string[] | null
  /** Thils's Vault: the relic taken. */
  vaultRelic?: string | null
  /** Thils's Vault: took the pass instead of a relic. */
  vaultPassed?: boolean
  /** Thils's Vault: relic ids given up when trading in for an offered relic. */
  vaultTradeIn?: string[] | null
  diedOnFloor: number | null
  lockoutDays: number | null
  lockoutRolls: number[] | null
}

/** The DM-only part of a run: runs/{runId}/dmOnly/room. Players can never read it. */
export interface DmRunState {
  /** Room kinds for the current floor (elite and Reprieve placement). */
  floorPlan: RoomKind[]
  /** The full current room, hidden parts included (null in the post-boss room). */
  room: Room | null
  /** The boss waiting at the end of this floor, picked when the floor starts. */
  bossId?: string | null
  /** Which boss was beaten on each floor this run (floor number as a string key -> boss id). */
  bossesBeaten?: Record<string, string>
}

export interface RunState {
  run: Run
  players: RunPlayer[]
  /** Present on the DM's screen only. */
  dm?: DmRunState
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
  /** Beat the legendary boss and extracted alive (counts toward the character's full clears). */
  fullClear?: boolean
  /** Items assigned to this character at extraction, plus a Vault relic on a full clear. */
  loot: LootItem[]
  /** Relic ids traded in at Thils's Vault (removed from the character on extraction). */
  relicsTradedIn?: string[]
}
