// The encounter generator (design bible: Enemy roster, How the generator
// builds an encounter, Encounter budgets, Encounter and boss defaults).
// Pure functions with a controllable `random`, like the room generator.
import enemyData from '../data/enemies.json'
import budgetData from '../data/encounter-budgets.json'
import benchmarkData from '../data/cr-benchmarks.json'
import boonData from '../data/boons.json'
import type { Random } from './draft'

export const FAMILIES = enemyData.families
export const CREATURES = enemyData.creatures
export type Creature = (typeof CREATURES)[number]
export type BudgetKind = 'low' | 'moderate' | 'high'

/** One kind of creature in an encounter (several of the same at the same CR). */
export interface EncounterGroup {
  creatureId: string
  /** The CR it fights at; above the roster CR when pushed. */
  cr: number
  count: number
  /** Absorbed Echoes: one boon per creature in the group. */
  boons?: { id: string; level: number }[]
  /** From a second family (splash) or the elite room's extra. */
  source?: 'splash' | 'elite'
  /** Shown to players by name (never stats). */
  revealed: boolean
}

export interface Encounter {
  family: string
  splashFamily: string | null
  /** Elite rooms: which extra the coin flip chose. */
  elite: 'next-floor' | 'push' | null
  budget: number
  /** XP of the encounter before the elite extra. */
  xp: number
  /** Highest CR allowed in the budget (the party's encounter level). */
  maxCr: number
  groups: EncounterGroup[]
}

const roll = (sides: number, random: Random) => 1 + Math.floor(random() * sides)
const pick = <T,>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]
const xpTable = budgetData.creatureXp as Record<string, number>

export const creatureOf = (id: string) => CREATURES.find((c) => c.id === id)!
export const familyOf = (id: string) => FAMILIES.find((f) => f.id === id)!

/** XP for one creature at a CR (pushed CRs use the table too). */
export function creatureXp(cr: number): number {
  return xpTable[String(cr)] ?? 0
}

export function floorOffset(floor: number) {
  return budgetData.floors.find((f) => f.floor === Math.min(Math.max(floor, 1), 4))!
}

/** Encounter level for one character on a floor: own level + offset, from 1 to 22. */
export function encounterLevel(level: number, floor: number): number {
  return Math.min(budgetData.budgets.length, Math.max(1, level + floorOffset(floor).offset))
}

/** The room's XP budget: each living player's own budget, added together. */
export function encounterBudget(levels: number[], floor: number): number {
  const kind = floorOffset(floor).budget as BudgetKind
  return levels.reduce((sum, level) => sum + budgetData.budgets[encounterLevel(level, floor) - 1][kind], 0)
}

/** Benchmark numbers for a CR (pushed creatures and bosses). */
export function benchmark(cr: number) {
  const rows = benchmarkData.benchmarks
  return rows[Math.min(rows.length, Math.max(1, Math.round(cr))) - 1]
}

/** Families allowed on a floor, with their odds. */
export function familyWeights(floor: number): { id: string; weight: number }[] {
  const key = String(Math.min(Math.max(floor, 1), 4))
  return FAMILIES.map((f) => ({ id: f.id, weight: (f.floorWeights as Record<string, number>)[key] ?? 0 })).filter(
    (f) => f.weight > 0,
  )
}

function pickFamily(floor: number, random: Random, exclude?: string): string | null {
  const options = familyWeights(floor).filter((f) => f.id !== exclude)
  const total = options.reduce((s, f) => s + f.weight, 0)
  if (total === 0) return null
  let r = random() * total
  for (const f of options) {
    r -= f.weight
    if (r < 0) return f.id
  }
  return options[options.length - 1].id
}

const ROLES = enemyData.roles
const groupXp = (groups: EncounterGroup[]) => groups.reduce((s, g) => s + creatureXp(g.cr) * g.count, 0)
const groupCount = (groups: EncounterGroup[]) => groups.reduce((s, g) => s + g.count, 0)

function add(groups: EncounterGroup[], c: Creature, source?: EncounterGroup['source']) {
  const same = groups.find((g) => g.creatureId === c.id && g.cr === c.cr && g.source === source)
  if (same) same.count++
  else groups.push({ creatureId: c.id, cr: c.cr, count: 1, revealed: false, ...(source ? { source } : {}) })
}

/**
 * Fill a budget from one family: one brute or elite, up to 2 support roles,
 * then minions (or the family's cheapest creature), never going over budget.
 */
function fill(family: string, budget: number, maxCr: number, maxCount: number, random: Random): EncounterGroup[] {
  const pool = CREATURES.filter((c) => c.family === family && c.cr <= maxCr)
  const all = pool.length ? pool : [...CREATURES.filter((c) => c.family === family)].sort((a, b) => a.cr - b.cr).slice(0, 1)
  const groups: EncounterGroup[] = []
  const fits = (c: Creature) => groupXp(groups) + creatureXp(c.cr) <= budget && groupCount(groups) < maxCount

  const anchors = all.filter((c) => ROLES.anchor.includes(c.role) && fits(c))
  if (anchors.length) add(groups, pick(anchors, random))
  else add(groups, [...all].sort((a, b) => a.cr - b.cr)[0]) // nothing fits: one creature anyway

  const supports = all.filter((c) => ROLES.support.includes(c.role))
  for (let added = 0; added < 2; added++) {
    const options = supports.filter(fits)
    if (!options.length) break
    add(groups, pick(options, random))
  }

  // Fill the rest. Each remaining slot aims at an even share of what's left:
  // minions while they're big enough for that share, otherwise the closest
  // fit from the whole family (so high tiers get elites in multiples).
  const minions = all.filter((c) => ROLES.filler.includes(c.role))
  const filler = minions.length ? minions : [[...all].sort((a, b) => a.cr - b.cr)[0]]
  for (;;) {
    const slotsLeft = maxCount - groupCount(groups)
    if (slotsLeft <= 0) break
    const share = (budget - groupXp(groups)) / slotsLeft
    const small = filler.filter(fits)
    const any = all.filter(fits)
    if (!any.length) break
    const bigEnough = small.filter((c) => creatureXp(c.cr) >= share / 2)
    if (bigEnough.length) {
      add(groups, pick(bigEnough, random))
      continue
    }
    const closest = Math.min(...any.map((c) => Math.abs(creatureXp(c.cr) - share)))
    add(groups, pick(any.filter((c) => Math.abs(creatureXp(c.cr) - share) === closest), random))
  }
  return groups
}

/** Spend leftover budget pushing CRs up, lowest CR first, so the push spreads evenly. */
function push(groups: EncounterGroup[], budget: number, maxCr: number) {
  const cap = Math.min(maxCr, budgetData.maxCreatureCr)
  for (;;) {
    const ordered = [...groups].sort((a, b) => a.cr - b.cr)
    const step = ordered.find((g) => {
      const next = Math.floor(g.cr) + 1
      return next <= cap && groupXp(groups) + (creatureXp(next) - creatureXp(g.cr)) * g.count <= budget
    })
    if (!step) return
    step.cr = Math.floor(step.cr) + 1
  }
}

/** Splash: swap the last-added creature for one from a second family, inside the budget. */
function splash(groups: EncounterGroup[], floor: number, family: string, budget: number, maxCr: number, random: Random) {
  const second = pickFamily(floor, random, family)
  if (!second || groups.length === 0) return null
  const last = groups[groups.length - 1]
  if (groupCount(groups) <= 1) return null
  last.count--
  if (last.count === 0) groups.pop()
  const room = budget - groupXp(groups)
  const options = CREATURES.filter((c) => c.family === second && c.cr <= maxCr && creatureXp(c.cr) <= room)
  if (!options.length) {
    // Nothing fits: put the creature back.
    if (last.count === 0) groups.push({ ...last, count: 1 })
    else last.count++
    return null
  }
  add(groups, pick(options, random), 'splash')
  return second
}

/** Elite rooms: a next-floor creature or one creature +2 CR, on top of the budget. */
function eliteExtra(groups: EncounterGroup[], floor: number, maxCr: number, random: Random): Encounter['elite'] {
  const nextFloor = floor < 4 && random() < 0.5
  if (nextFloor) {
    const family = pickFamily(floor + 1, random)
    const options = CREATURES.filter((c) => c.family === family)
    const fitting = options.filter((c) => c.cr <= maxCr)
    const c = fitting.length ? pick(fitting, random) : [...options].sort((a, b) => a.cr - b.cr)[0]
    add(groups, c, 'elite')
    return 'next-floor'
  }
  const target = pick(groups, random)
  const pushedCr = Math.min(budgetData.maxCreatureCr, Math.floor(target.cr) + budgetData.elitePushCr)
  if (target.count > 1) {
    target.count--
    groups.push({ creatureId: target.creatureId, cr: pushedCr, count: 1, revealed: false, source: 'elite' })
  } else {
    target.cr = pushedCr
    target.source = 'elite'
  }
  return 'push'
}

/** A random Level 1 or 2 boon for an Absorbed Echo, never a Payoff. */
function echoBoon(random: Random): { id: string; level: number } {
  const pool = boonData.filter((b) => b.kind !== 'payoff')
  return { id: pick(pool, random).id, level: roll(2, random) }
}

/**
 * Generate a non-boss room's encounter.
 * `levels`: each living player's own level. `partyLevel` caps CRs.
 */
export function generateEncounter(
  floor: number,
  elite: boolean,
  levels: number[],
  partyLevel: number,
  random: Random,
): Encounter {
  const budget = encounterBudget(levels, floor)
  const maxCr = encounterLevel(partyLevel, floor)
  const maxCount = Math.max(1, levels.length * budgetData.maxCreaturesPerPlayer)
  const family = pickFamily(floor, random)!
  const groups = fill(family, budget, maxCr, maxCount, random)
  const splashFamily =
    roll(budgetData.splashChanceOneIn, random) === 1 ? splash(groups, floor, family, budget, maxCr, random) : null
  push(groups, budget, maxCr)
  const xp = groupXp(groups)
  const eliteKind = elite ? eliteExtra(groups, floor, maxCr, random) : null
  for (const g of groups) {
    if (familyOf(creatureOf(g.creatureId).family).carriesBoon) {
      g.boons = Array.from({ length: g.count }, () => echoBoon(random))
    }
  }
  return { family, splashFamily, elite: eliteKind, budget, xp, maxCr, groups }
}

/** Benchmark numbers to use for a group pushed above its roster CR (null if not pushed). */
export function pushedStats(group: EncounterGroup) {
  const base = creatureOf(group.creatureId).cr
  return group.cr > base ? benchmark(group.cr) : null
}

/** What players may see of an encounter: revealed creatures' names and counts only. */
export function encounterView(encounter: Encounter | null | undefined): { creatureId: string; count: number }[] {
  if (!encounter) return []
  const shown = new Map<string, number>()
  for (const g of encounter.groups) {
    if (g.revealed) shown.set(g.creatureId, (shown.get(g.creatureId) ?? 0) + g.count)
  }
  return [...shown].map(([creatureId, count]) => ({ creatureId, count }))
}

export function crLabel(cr: number): string {
  return cr === 0.5 ? '1/2' : String(cr)
}
