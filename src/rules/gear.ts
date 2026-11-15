// Gear drops and cards (design bible: Gear (d20), Who gear drops for, Gear
// item cards, Base weapons, Base armor). Each gear roll is aimed at one
// character in the run and only rolls rows and bases they're trained in;
// bases they have Weapon Mastery with weigh x2. Cards show the base's stats
// with the magic bonus applied. Bases live in src/data/gear-bases.json.
import itemData from '../data/loot-items.json'
import type { RunPlayer } from '../model/run'
import type { Random } from './draft'
import type { LootItem, Rarity } from './loot'
import { armorBase, trainedWithArmor, trainedWithWeapon, weaponBase, type ArmorBase, type WeaponBase } from './build'

export interface GearRow {
  id: string
  name: string
  /** Base ids in roll order (the bible's Base (roll) column). */
  bases: string[]
  property: string
  /** A spellcasting focus: its bonus also applies to spell attack rolls and spell save DCs. */
  isFocus?: boolean
}

/** What a run remembers about a character's training, captured at run start. */
export interface RunTraining {
  weapons: string[]
  armor: string[]
  masteries: string[]
}

export const GEAR_ROWS = itemData.gear as GearRow[]
export const gearRow = (id: string) => GEAR_ROWS.find((g) => g.id === id)!
/** Mastery picks weigh this much more when rolling a base. */
const MASTERY_WEIGHT = 2

/** The magic bonus for a rarity: common 0, uncommon +1, rare +2, very rare and legendary +3. */
export const gearBonus = (rarity: Rarity | null) => (itemData.gearBonus as Record<string, number>)[rarity ?? 'common'] ?? 0

/** A base id is a weapon or an armor (shield included). */
export const baseOf = (id: string): { weapon?: WeaponBase; armor?: ArmorBase } => ({ weapon: weaponBase(id), armor: armorBase(id) })
export const baseName = (id: string) => weaponBase(id)?.name ?? armorBase(id)?.name ?? id

/** Is someone with this training able to use this base? */
export function canUseBase(training: RunTraining, baseId: string): boolean {
  const t = { weapons: new Set(training.weapons), armor: new Set(training.armor) }
  const { weapon, armor } = baseOf(baseId)
  if (weapon) return trainedWithWeapon(t, weapon)
  if (armor) return trainedWithArmor(t, armor)
  return false
}

/** Bases of a row this training can use (every base when the training isn't known). */
export function usableBases(row: GearRow, training: RunTraining | undefined): string[] {
  return training ? row.bases.filter((b) => canUseBase(training, b)) : row.bases
}

function weightedPick<T>(items: T[], weight: (t: T) => number, random: Random): T {
  const total = items.reduce((s, t) => s + weight(t), 0)
  let r = random() * total
  for (const t of items) {
    r -= weight(t)
    if (r < 0) return t
  }
  return items[items.length - 1]
}

export interface GearRoll {
  ref: string
  base: string
  secondRef?: string
  forCharacterId?: string
}

/**
 * Roll a gear drop aimed at one character: a random player in the run (fallen
 * ones included) unless `aimAt` names one. Only rows with a base they can use
 * are rolled; their mastery bases weigh x2. With no training known (runs from
 * before builds), any row and base can roll.
 */
export function rollGear(players: Pick<RunPlayer, 'characterId' | 'training'>[], rarity: Rarity, random: Random, aimAt?: string): GearRoll {
  const target = aimAt ? players.find((p) => p.characterId === aimAt) : players.length ? players[Math.floor(random() * players.length)] : undefined
  const training = target?.training
  let rows = GEAR_ROWS.filter((r) => usableBases(r, training).length > 0)
  if (rows.length === 0) rows = GEAR_ROWS // nobody can use anything: roll freely
  const row = rows[Math.floor(random() * rows.length)]
  const options = usableBases(row, training).length ? usableBases(row, training) : row.bases
  const mastered = new Set(training?.masteries ?? [])
  const base = weightedPick(options, (b) => (mastered.has(b) ? MASTERY_WEIGHT : 1), random)
  const out: GearRoll = { ref: row.id, base }
  if (target) out.forCharacterId = target.characterId
  if (rarity === itemData.gearSecondPropertyAt) {
    const others = GEAR_ROWS.filter((g) => g.id !== row.id)
    out.secondRef = others[Math.floor(random() * others.length)].id
  }
  return out
}

/** "Columnbreaker (warhammer) +1"; older drops without a base read "Columnbreaker +1". */
export function gearName(item: Pick<LootItem, 'ref' | 'rarity' | 'base'>): string {
  const bonus = gearBonus(item.rarity)
  const base = item.base ? ` (${baseName(item.base).toLowerCase()})` : ''
  return `${gearRow(item.ref).name}${base}${bonus ? ` +${bonus}` : ''}`
}

/** The base item's cost in credits (1 gp = 1 credit), added to gear value. */
export const baseCost = (baseId: string | undefined) => (baseId ? (weaponBase(baseId)?.cost ?? armorBase(baseId)?.cost ?? 0) : 0)

/** Players in the run who aren't trained for this item's base (for the card's flag). */
export function untrainedNames(baseId: string | undefined, players: Pick<RunPlayer, 'name' | 'training'>[]): string[] {
  if (!baseId) return []
  return players.filter((p) => p.training && !canUseBase(p.training, baseId)).map((p) => p.name)
}

/** One row on a gear or relic card. */
export interface CardField {
  label: string
  value: string
}

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`)

/** The base's stats with a magic bonus applied, as card rows (Gear item cards). */
export function baseFields(baseId: string, bonus: number): CardField[] {
  const { weapon: w, armor: a } = baseOf(baseId)
  if (w) {
    const plus = bonus ? ` + ${bonus}` : ''
    const versatile = w.properties.map((p) => p.match(/^Versatile \((.+)\)$/)?.[1]).find(Boolean)
    const damage = `${w.damage}${plus} ${w.damageType}${versatile ? `, or ${versatile}${plus} two-handed` : ''}`
    const fields: CardField[] = [
      { label: 'Type', value: `${w.category === 'simple' ? 'Simple' : 'Martial'} ${w.range} weapon` },
      { label: 'Attack and damage', value: bonus ? `${sign(bonus)} to attack rolls; ${damage}` : damage },
      { label: 'Properties', value: w.properties.join(', ') || 'None' },
      { label: 'Mastery', value: `${w.mastery} (only with Weapon Mastery for the ${w.name.toLowerCase()})` },
      { label: 'Weight', value: w.weight },
    ]
    const ammo = w.properties.map((p) => p.match(/^Ammunition \(.+, (\w+)\)$/)?.[1]).find(Boolean)
    if (bonus && ammo) fields[1].value += ` (the bonus applies to the ${w.name.toLowerCase()}, not its ${ammo}s)`
    return fields
  }
  if (a) {
    const dex = a.dex === 'full' ? ' + Dex' : a.dex === 'max 2' ? ' + Dex (max 2)' : ''
    const ac = a.type === 'shields' ? `+${a.ac + bonus}${bonus ? ` (+${a.ac} + ${bonus})` : ''}` : `${a.ac + bonus}${dex}${bonus ? ` (${a.ac} + ${bonus})` : ''}`
    const fields: CardField[] = [
      { label: 'Type', value: a.type === 'shields' ? 'Shield' : `${a.type[0].toUpperCase()}${a.type.slice(1)} armor` },
      { label: 'AC', value: ac },
    ]
    if (a.strength) fields.push({ label: 'Strength', value: `${a.strength}, or speed drops by 10 ft` })
    fields.push({ label: 'Stealth', value: a.stealthDisadvantage ? 'Disadvantage' : 'Normal' })
    fields.push({ label: 'Weight', value: a.weight })
    return fields
  }
  return []
}
