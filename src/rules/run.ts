// Run math from the design bible. Numbers come from src/data/rules.json and
// src/data/pressures.json, so tuning the game means editing data, not code.
import rules from '../data/rules.json'
import pressures from '../data/pressures.json'

export interface Pressure {
  id: string
  name: string
  effect: string
  bonusPercent: number
  /** Extra Pressures rank the party needs (0 = available from the start). */
  unlockRank: number
  /** Harsher versions replace their base version. */
  replaces?: string
  status: string
}

export const PRESSURES: Pressure[] = pressures
export const FLOORS = rules.floors
export const LAST_FLOOR = FLOORS[FLOORS.length - 1].floor

export function floorInfo(floor: number) {
  const info = FLOORS.find((f) => f.floor === floor)
  if (!info) throw new Error(`Unknown floor ${floor}`)
  return info
}

/** Party level: the average of the party's levels, rounded down (Build clarification 3). */
export function partyLevel(levels: number[]): number {
  if (levels.length === 0) return 0
  return Math.floor(levels.reduce((sum, l) => sum + l, 0) / levels.length)
}

/** Entry-level reward multiplier for a party level (x1, x2 or x4). */
export function entryMultiplier(level: number): number {
  const tier = rules.entryTiers.find((t) => level >= t.minLevel && level <= t.maxLevel)
  return tier?.multiplier ?? 1
}

/** Pressures the party may pick, given the highest Extra Pressures rank anyone owns. */
export function availablePressures(extraPressuresRank: number): Pressure[] {
  return PRESSURES.filter((p) => p.unlockRank <= extraPressuresRank)
}

/** Total Pressure bonus percent. Bonuses stack by adding. */
export function pressureBonusPercent(pressureIds: string[]): number {
  return pressureIds.reduce(
    (sum, id) => sum + (PRESSURES.find((p) => p.id === id)?.bonusPercent ?? 0),
    0,
  )
}

/** Picking a harsher version drops its base version (and the other way round). */
export function togglePressure(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id)
  const picked = PRESSURES.find((p) => p.id === id)
  const conflicts = new Set<string>()
  if (picked?.replaces) conflicts.add(picked.replaces)
  for (const p of PRESSURES) if (p.replaces === id) conflicts.add(p.id)
  return [...selected.filter((s) => !conflicts.has(s)), id]
}

/** Quantum Basalts each player banks for beating a floor's boss, before Pressure bonuses. */
export function bossQuantumBasalts(floor: number, multiplier: number): number {
  return floorInfo(floor).bossQuantumBasalts * multiplier
}

/** Quantum Basalts for one pass. Pressure bonuses don't apply (Build clarification 10). */
export function passQuantumBasalts(multiplier: number): number {
  return rules.passQuantumBasalts * multiplier
}

/**
 * Earned (boss) Quantum Basalts after Pressure bonuses, rounded up per player.
 * Passed Basalts are added separately and never get the bonus.
 */
export function withPressureBonus(earned: number, bonusPercent: number): number {
  return Math.ceil((earned * (100 + bonusPercent)) / 100)
}

/** Share of run loot kept when extracting after the given floor's boss (0 if no boss beaten). */
export function lootKeptPercent(lastBossFloor: number): number {
  if (lastBossFloor < 1) return 0
  return floorInfo(lastBossFloor).lootKeptPercent
}

/** Devotions each living player earns for clearing a room. */
export function devotionsForRoom(kind: 'combat' | 'elite' | 'reprieve' | 'boss'): number {
  if (kind === 'reprieve') return 0
  if (kind === 'elite') return rules.devotionsPerRoomClear + rules.eliteExtraDevotions
  return rules.devotionsPerRoomClear
}

/**
 * Death lockout: 1d4 days per floor reached. `roll` returns 1..sides,
 * and can be swapped out in tests.
 */
export function rollLockoutDays(
  floorReached: number,
  roll: (sides: number) => number = (sides) => 1 + Math.floor(Math.random() * sides),
): { days: number; rolls: number[] } {
  const rolls = Array.from({ length: floorReached }, () => roll(rules.lockoutDieSides))
  return { days: rolls.reduce((a, b) => a + b, 0), rolls }
}
