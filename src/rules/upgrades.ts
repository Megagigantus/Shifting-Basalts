// Upgrade math. Prices and effects come from src/data/upgrades.json.
import data from '../data/upgrades.json'

export type UpgradeScope = 'personal' | 'party-per-owner' | 'party-highest'

export interface Upgrade {
  id: string
  name: string
  /** Cost of each rank, in Quantum Basalts: costs[0] buys rank 1. */
  costs: number[]
  effect: string
  scope: UpgradeScope
  status: string
}

export const UPGRADES = data.upgrades as Upgrade[]

export function upgradeById(id: string): Upgrade {
  const upgrade = UPGRADES.find((u) => u.id === id)
  if (!upgrade) throw new Error(`Unknown upgrade ${id}`)
  return upgrade
}

export const maxRank = (id: string) => upgradeById(id).costs.length

/** Price of the next rank, or null when the upgrade is maxed. */
export function nextRankCost(id: string, owned: number): number | null {
  const costs = upgradeById(id).costs
  return owned < costs.length ? costs[owned] : null
}

/** Price of the rank already owned at `owned` (for refunds). */
export function ownedRankCost(id: string, owned: number): number | null {
  return owned >= 1 ? upgradeById(id).costs[owned - 1] : null
}

type Owned = { upgrades: Record<string, number> }
const rankOf = (c: Owned, id: string) => c.upgrades[id] ?? 0

/** Highest rank of an upgrade anyone in the party owns. */
export function highestRank(party: Owned[], id: string): number {
  return Math.max(0, ...party.map((c) => rankOf(c, id)))
}

/** How many people in the party own at least one rank. */
export function ownerCount(party: Owned[], id: string): number {
  return party.filter((c) => rankOf(c, id) > 0).length
}

/** Party-wide reward bonus from Extra Pressures owners (+5% each, the first included). */
export function extraPressuresBonusPercent(party: Owned[]): number {
  return ownerCount(party, 'extra-pressures') * data.extraPressuresBonusPerOwner
}

/** A player's own Extra Loot bonus on boss Quantum Basalts. */
export function extraLootBonusPercent(character: Owned): number {
  return rankOf(character, 'extra-loot') * data.extraLootBonusPerRank
}

/** Extra loot share kept on extraction from Deep Pockets (highest rank in the party). */
export function deepPocketsPercent(party: Owned[]): number {
  return highestRank(party, 'deep-pockets') * data.deepPocketsPerRank
}

/** Days Quick Return takes off a death lockout. */
export function quickReturnDays(character: Owned): number {
  return rankOf(character, 'quick-return') * data.quickReturnDaysPerRank
}

/** A rolled lockout after Quick Return, never below the minimum. */
export function shortenedLockout(rolledDays: number, reduction: number): number {
  return Math.max(data.minimumLockoutDays, rolledDays - reduction)
}

/** Total Quantum Basalts to buy every rank of every upgrade (the bible says about 1,000). */
export function costOfEverything(): number {
  return UPGRADES.reduce((sum, u) => sum + u.costs.reduce((a, b) => a + b, 0), 0)
}

/**
 * The Healing Font in a post-boss room (Phase 7 defaults): living owners, and
 * the temp HP each player gains (+5 per owner beyond the first). Null when no
 * living player owns it.
 */
export function healingFont(players: { alive: boolean; healingFontOwner?: boolean }[]): { owners: number; tempHp: number } | null {
  const owners = players.filter((p) => p.alive && p.healingFontOwner).length
  if (owners === 0) return null
  return { owners, tempHp: (owners - 1) * data.healingFontTempHpPerExtraOwner }
}
