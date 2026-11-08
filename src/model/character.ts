// A saved character: the lean profile from the design bible's
// "App requirements > Characters" section. The dungeon layer (boons, stat
// tracks, upgrades, Quantum Basalts...) is added in later steps.

export type CasterType = 'none' | 'half' | 'full' | 'pact'
export type AttackStyle = 'melee' | 'ranged' | 'spells'

export interface CharacterProfile {
  name: string
  /** Lowercase Google email of the player who owns this character, or "" if unassigned. */
  playerEmail: string
  /** Class id from src/data/classes.json. */
  classId: string
  subclass: string
  level: number
  casterType: CasterType
  /** Spell slot levels the character has (1 to 9). Empty for non-casters. */
  slotLevels: number[]
  hasSummon: boolean
  attackStyle: AttackStyle
}

export interface Character extends CharacterProfile {
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
    casterType: 'none',
    slotLevels: [],
    hasSummon: false,
    attackStyle: 'melee',
  }
}
