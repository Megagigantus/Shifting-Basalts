// A saved character: the lean profile from the design bible's
// "App requirements > Characters" section, plus the permanent dungeon layer.
import type { LootItem } from '../rules/loot'

export type CasterType = 'none' | 'half' | 'full' | 'pact'
export type AttackStyle = 'melee' | 'ranged' | 'spells'

/** What the player confirms at run setup. Edited in the character form. */
export interface CharacterProfile {
  name: string
  /** Lowercase Google email of the player who owns this character, or "" if unassigned. */
  playerEmail: string
  /** Primary class id from src/data/classes.json ("homebrew" for a homebrew class). */
  classId: string
  /** Primary class's subclass (from the class's list, or a custom name). */
  subclass: string
  /** Total character level (both classes); sets PB and counts toward party level. */
  level: number
  /** Build (design bible: Character setup). Levels in the primary class. */
  classLevel: number
  /** Optional second class for a multiclass ("" for none), its levels and subclass. */
  secondClassId: string
  secondClassLevel: number
  secondSubclass: string
  /** Level 1 picks that change training, by class id: { cleric: 'protector' }. */
  classOrders: Record<string, string>
  /** Training a feat, species or origin grants, on top of the class's: weapon tokens or ids, armor types. */
  extraWeapons: string[]
  extraArmor: string[]
  /** Weapon Mastery picks (weapon ids from src/data/gear-bases.json). */
  masteries: string[]
  /** Homebrew class: the player's own boon tags (up to 3 each). */
  homebrewTags: { primary: string[]; secondary: string[] }
  casterType: CasterType
  /** Spell slot levels the character has (1 to 9). Empty for non-casters. */
  slotLevels: number[]
  hasSummon: boolean
  attackStyle: AttackStyle
  /**
   * Extra tags the draft treats as primary for this character, e.g. Bond for a
   * Beast Master Ranger (design bible: Offer weighting, Subclasses).
   */
  favoredTags: string[]
  /** Portrait from the gallery (a file name in src/art/portraits), or "" for none. */
  portrait: string
  /** Summon token art (a file name in src/art/summons), or "" for the default. */
  summonArt: string
}

/** What persists between runs. Changed by runs and upgrades, not the profile form. */
export interface DungeonLayer {
  bankedQuantumBasalts: number
  /** Devotions earned but not yet spent on stat tracks. */
  bankedDevotions: number
  /** Stat track id -> Devotions invested in it. Ranks come from rules/statTracks.ts. */
  trackDevotions: Record<string, number>
  deepestFloor: number
  /** Days left on a death lockout; the DM clears it by hand. 0 = free to enter. */
  lockoutDays: number
  /** Upgrade id -> rank owned. */
  upgrades: Record<string, number>
  /** Banish list: boon ids that never appear in this character's offers (Build clarification 14). */
  banished: string[]
  /** Attunement: the tag the first offer of each run includes. */
  attuneTag: string | null
  /** Set while the character is in a run; Banish and Attunement lock until it clears. */
  activeRunId: string | null
  /** Loot this character carried out of the Basalts, relics included (missing on older characters). */
  loot?: OwnedLoot[]
}

/** An item a character took home from a run. */
export type OwnedLoot = LootItem & { runId: string }

export interface Character extends CharacterProfile, DungeonLayer {
  id: string
}

export const CASTER_TYPES: { id: CasterType; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'half', label: 'Half caster' },
  { id: 'full', label: 'Full caster' },
  { id: 'pact', label: 'Pact Magic' },
]

export const ATTACK_STYLES: { id: AttackStyle; label: string }[] = [
  { id: 'melee', label: 'Melee' },
  { id: 'ranged', label: 'Ranged' },
  { id: 'spells', label: 'Spells' },
]

export function emptyProfile(): CharacterProfile {
  return {
    name: '',
    playerEmail: '',
    classId: 'fighter',
    subclass: '',
    level: 5,
    classLevel: 5,
    secondClassId: '',
    secondClassLevel: 0,
    secondSubclass: '',
    classOrders: {},
    extraWeapons: [],
    extraArmor: [],
    masteries: [],
    homebrewTags: { primary: [], secondary: [] },
    casterType: 'none',
    slotLevels: [],
    hasSummon: false,
    attackStyle: 'melee',
    favoredTags: [],
    portrait: '',
    summonArt: '',
  }
}

export function emptyDungeonLayer(): DungeonLayer {
  return {
    bankedQuantumBasalts: 0,
    bankedDevotions: 0,
    trackDevotions: {},
    deepestFloor: 0,
    lockoutDays: 0,
    upgrades: {},
    banished: [],
    attuneTag: null,
    activeRunId: null,
    loot: [],
  }
}

/** Just the profile fields of a character, for the edit form. */
export function profileOf(c: Character): CharacterProfile {
  return {
    name: c.name,
    playerEmail: c.playerEmail,
    classId: c.classId,
    subclass: c.subclass,
    level: c.level,
    ...buildOf(c),
    casterType: c.casterType,
    slotLevels: c.slotLevels,
    hasSummon: c.hasSummon,
    attackStyle: c.attackStyle,
    favoredTags: c.favoredTags ?? [],
    portrait: c.portrait ?? '',
    summonArt: c.summonArt ?? '',
  }
}

/** A character's build fields, with defaults for characters saved before builds existed. */
export function buildOf(c: Partial<CharacterProfile> & { level: number }): Pick<
  CharacterProfile,
  'classLevel' | 'secondClassId' | 'secondClassLevel' | 'secondSubclass' | 'classOrders' | 'extraWeapons' | 'extraArmor' | 'masteries' | 'homebrewTags'
> {
  const secondClassLevel = c.secondClassId ? (c.secondClassLevel ?? 0) : 0
  return {
    classLevel: c.classLevel ?? Math.max(1, c.level - secondClassLevel),
    secondClassId: c.secondClassId ?? '',
    secondClassLevel,
    secondSubclass: c.secondSubclass ?? '',
    classOrders: c.classOrders ?? {},
    extraWeapons: c.extraWeapons ?? [],
    extraArmor: c.extraArmor ?? [],
    masteries: c.masteries ?? [],
    homebrewTags: { primary: c.homebrewTags?.primary ?? [], secondary: c.homebrewTags?.secondary ?? [] },
  }
}
