// Character builds (design bible: Character setup, Who gear drops for, Offer
// weighting > Multiclass). Works out a character's weapon and armor training,
// their Weapon Mastery pick count, and the boon tag weights their drafts use.
// Class data is in src/data/classes.json; bases in src/data/gear-bases.json.
import classData from '../data/classes.json'
import classTagData from '../data/class-tags.json'
import baseData from '../data/gear-bases.json'
import type { CharacterProfile } from '../model/character'
import { MAX_LEVEL } from './proficiency'

export interface TrainingGrant {
  weapons: string[]
  armor: string[]
}

export interface ClassInfo extends TrainingGrant {
  id: string
  name: string
  homebrew?: boolean
  multiclass: TrainingGrant
  subclasses: string[]
  /** [class level, picks] steps, e.g. [[1, 3], [4, 4]]; missing for classes without Weapon Mastery. */
  mastery?: number[][]
  subclassGrants?: Record<string, TrainingGrant>
  order?: { name: string; options: (TrainingGrant & { id: string; name: string })[] }
}

export interface WeaponBase {
  id: string
  name: string
  category: 'simple' | 'martial'
  range: 'melee' | 'ranged'
  damage: string
  damageType: string
  properties: string[]
  mastery: string
  weight: string
  cost: number
}

export interface ArmorBase {
  id: string
  name: string
  type: 'light' | 'medium' | 'heavy' | 'shields'
  ac: number
  dex: 'full' | 'max 2' | 'none'
  strength: number | null
  stealthDisadvantage: boolean
  weight: string
  cost: number
}

export const CLASSES = classData as ClassInfo[]
export const WEAPON_BASES = baseData.weapons as WeaponBase[]
export const ARMOR_BASES = baseData.armor as ArmorBase[]
export const MASTERIES = baseData.masteries as Record<string, string>
export const HOMEBREW = 'homebrew'
/** Most tags a homebrew class may pick in each band. */
export const HOMEBREW_TAG_LIMIT = 3
/** Most Weapon Mastery picks a homebrew class may set by hand. */
export const HOMEBREW_MASTERY_LIMIT = 6
/** A second class's subclass and tag weights start at this class level. */
export const SUBCLASS_LEVEL = 3

/** Weapon training tokens, besides specific weapon ids. */
export const WEAPON_TOKENS: { id: string; label: string }[] = [
  { id: 'simple', label: 'Simple weapons' },
  { id: 'martial', label: 'Martial weapons' },
  { id: 'martial-light', label: 'Martial weapons with Light' },
  { id: 'martial-finesse-or-light', label: 'Martial weapons with Finesse or Light' },
]
export const ARMOR_TYPES: { id: string; label: string }[] = [
  { id: 'light', label: 'Light armor' },
  { id: 'medium', label: 'Medium armor' },
  { id: 'heavy', label: 'Heavy armor' },
  { id: 'shields', label: 'Shields' },
]

export const classInfo = (id: string): ClassInfo | undefined => CLASSES.find((c) => c.id === id)
export const weaponBase = (id: string): WeaponBase | undefined => WEAPON_BASES.find((w) => w.id === id)
export const armorBase = (id: string): ArmorBase | undefined => ARMOR_BASES.find((a) => a.id === id)

type Build = Pick<
  CharacterProfile,
  'classId' | 'subclass' | 'classLevel' | 'secondClassId' | 'secondClassLevel' | 'secondSubclass' | 'classOrders' | 'extraWeapons' | 'extraArmor' | 'masteries' | 'homebrewTags'
>

/** Both classes' levels added together. */
export const totalLevel = (b: Pick<Build, 'classLevel' | 'secondClassId' | 'secondClassLevel'>) =>
  b.classLevel + (b.secondClassId ? b.secondClassLevel : 0)

/**
 * The main class: the one with more levels, the primary class on a tie. Its
 * class trigger and hidden boon are the character's.
 */
export function mainClassId(b: Pick<Build, 'classId' | 'classLevel' | 'secondClassId' | 'secondClassLevel'>): string {
  return b.secondClassId && b.secondClassLevel > b.classLevel ? b.secondClassId : b.classId
}

/** Grants from a class's level 1 order and its subclass (when the subclass is unlocked). */
function extraGrants(info: ClassInfo, level: number, subclass: string, orders: Record<string, string>): TrainingGrant[] {
  const out: TrainingGrant[] = []
  const order = info.order?.options.find((o) => o.id === orders[info.id])
  if (order) out.push(order)
  if (level >= SUBCLASS_LEVEL && info.subclassGrants?.[subclass]) out.push(info.subclassGrants[subclass])
  return out
}

/**
 * Everything a character is trained in: the primary class's full training, a
 * second class's multiclass training, order and subclass grants, and any extra
 * training the player ticked.
 */
export function trainingOf(b: Build): { weapons: Set<string>; armor: Set<string> } {
  const grants: TrainingGrant[] = []
  const first = classInfo(b.classId)
  if (first) grants.push(first, ...extraGrants(first, b.classLevel, b.subclass, b.classOrders))
  const second = b.secondClassId ? classInfo(b.secondClassId) : undefined
  if (second) grants.push(second.multiclass, ...extraGrants(second, b.secondClassLevel, b.secondSubclass, b.classOrders))
  grants.push({ weapons: b.extraWeapons, armor: b.extraArmor })
  return {
    weapons: new Set(grants.flatMap((g) => g.weapons)),
    armor: new Set(grants.flatMap((g) => g.armor)),
  }
}

/** Is a character with this training trained in this weapon? */
export function trainedWithWeapon(training: { weapons: Set<string> }, w: WeaponBase): boolean {
  const t = training.weapons
  if (t.has(w.id) || t.has(w.category)) return true
  if (w.category !== 'martial') return false
  if (t.has('martial-light') && w.properties.includes('Light')) return true
  return t.has('martial-finesse-or-light') && (w.properties.includes('Light') || w.properties.includes('Finesse'))
}

/** Is a character with this training trained in this armor (or shield)? */
export const trainedWithArmor = (training: { armor: Set<string> }, a: ArmorBase) => training.armor.has(a.type)

/** Picks a class gives at a class level, from its [level, picks] steps (0 without Weapon Mastery). */
function picksAt(info: ClassInfo | undefined, level: number): number {
  let picks = 0
  for (const [from, n] of info?.mastery ?? []) if (level >= from) picks = n
  return picks
}

/**
 * How many Weapon Mastery picks a character has: the higher of their classes'
 * counts (Character setup), or up to HOMEBREW_MASTERY_LIMIT set by hand for a homebrew class.
 */
export function masteryPicks(b: Build): number {
  if (b.classId === HOMEBREW) return HOMEBREW_MASTERY_LIMIT
  const first = picksAt(classInfo(b.classId), b.classLevel)
  const second = b.secondClassId ? picksAt(classInfo(b.secondClassId), b.secondClassLevel) : 0
  return Math.max(first, second)
}

/** Weapons a character may pick for Weapon Mastery: ones they're trained in. */
export function masteryOptions(b: Build): WeaponBase[] {
  const training = trainingOf(b)
  return WEAPON_BASES.filter((w) => trainedWithWeapon(training, w))
}

function tagMap(classId: string, homebrewTags: Build['homebrewTags']): { primary: string[]; secondary: string[] } {
  if (classId === HOMEBREW) return homebrewTags
  const row = classTagData.classes.find((c) => c.classId === classId)
  return { primary: row?.primary ?? [], secondary: row?.secondary ?? [] }
}

/**
 * The class factor for each boon tag (Offer weighting > Multiclass): the main
 * class's primary ×3 and secondary ×2; a second class with 3+ levels adds its
 * primary tags at ×2; on an exact tie both classes use their full maps. A tag
 * in more than one map keeps its highest factor. Favored tags (a subclass
 * shift) count as primary.
 */
export function tagWeights(b: Build, favoredTags: string[] = []): Record<string, number> {
  const { primaryTag, secondaryTag } = classTagData.weights
  const out: Record<string, number> = {}
  const add = (tags: string[], factor: number) => {
    for (const t of tags) out[t] = Math.max(out[t] ?? 1, factor)
  }
  const main = mainClassId(b)
  const mainMap = tagMap(main, b.homebrewTags)
  add(mainMap.primary, primaryTag)
  add(mainMap.secondary, secondaryTag)
  const other = b.secondClassId ? (main === b.classId ? b.secondClassId : b.classId) : ''
  if (other) {
    const otherMap = tagMap(other, b.homebrewTags)
    if (b.secondClassLevel === b.classLevel) {
      add(otherMap.primary, primaryTag)
      add(otherMap.secondary, secondaryTag)
    } else if ((other === b.secondClassId ? b.secondClassLevel : b.classLevel) >= SUBCLASS_LEVEL) {
      add(otherMap.primary, secondaryTag)
    }
  }
  add(favoredTags, primaryTag)
  return out
}

/** One line describing a build, e.g. "Fighter 6 (Champion) / Wizard 3 (Evoker)". */
export function buildSummary(b: Build): string {
  const part = (id: string, level: number, sub: string) => `${classInfo(id)?.name ?? id} ${level}${sub ? ` (${sub})` : ''}`
  const first = part(b.classId, b.classLevel, b.subclass)
  return b.secondClassId ? `${first} / ${part(b.secondClassId, b.secondClassLevel, b.secondSubclass)}` : first
}

export type BuildFields = Pick<
  CharacterProfile,
  'classId' | 'subclass' | 'classLevel' | 'secondClassId' | 'secondClassLevel' | 'secondSubclass' | 'classOrders' | 'extraWeapons' | 'extraArmor' | 'masteries' | 'homebrewTags'
>

/** Drop mastery picks the build no longer qualifies for (training changed, or fewer picks). */
export function cleanBuild(b: BuildFields): BuildFields {
  const allowed = new Set(masteryOptions(b).map((w) => w.id))
  const masteries = b.masteries.filter((id) => allowed.has(id)).slice(0, masteryPicks(b))
  const secondClassId = b.secondClassId === b.classId ? '' : b.secondClassId
  return {
    ...b,
    masteries,
    secondClassId,
    secondClassLevel: secondClassId ? b.secondClassLevel : 0,
    secondSubclass: secondClassId ? b.secondSubclass : '',
    subclass: b.subclass.trim(),
  }
}

/** Problems with a build before saving, or null when it's fine. */
export function buildError(b: BuildFields, minTotal: number): string | null {
  const whole = (n: number) => Number.isInteger(n) && n >= 1
  if (!whole(b.classLevel)) return 'Class level must be a whole number, 1 or more.'
  if (b.secondClassId && !whole(b.secondClassLevel)) return 'Second class level must be a whole number, 1 or more.'
  const total = totalLevel(b)
  if (total < minTotal || total > MAX_LEVEL) return `Total level must be from ${minTotal} to ${MAX_LEVEL}.`
  return null
}

/** Training as short labels: tokens, armor types and specific weapons. */
export function trainingLabels(b: BuildFields): { weapons: string[]; armor: string[] } {
  const t = trainingOf(b)
  const weapons = [...t.weapons].map((id) => WEAPON_TOKENS.find((w) => w.id === id)?.label ?? weaponBase(id)?.name ?? id)
  const armor = ARMOR_TYPES.filter((a) => t.armor.has(a.id)).map((a) => a.label)
  return { weapons, armor }
}
