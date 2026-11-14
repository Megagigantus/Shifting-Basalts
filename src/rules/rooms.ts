// The room generator (design bible: Room layouts, Room flavor, Room tricks,
// Room condition pool, Room generator defaults, Player view visibility).
// Pure functions with a controllable `random`, like the draft generator.
import layouts from '../data/room-layouts.json'
import flavor from '../data/room-flavor.json'
import trickData from '../data/room-tricks.json'
import conditionData from '../data/room-conditions.json'
import rules from '../data/rules.json'
import upgrades from '../data/upgrades.json'
import type { RoomKind } from '../model/run'
import { proficiencyBonus } from './proficiency'
import type { Random } from './draft'
import { encounterView, type Encounter } from './encounters'
import type { HpShown, HpState } from './hp'
import type { BattleMap } from './battleMap'

export const SHAPES = layouts.shapes
export const TERRAIN = layouts.terrain
export const TRICKS = trickData.tricks
export const CONDITIONS = conditionData.conditions

/** A trick placed in a room. `revealed` once it has sprung or the DM shows it. */
export interface PlacedTrick {
  id: string
  revealed: boolean
}

/** A generated room, as the DM sees it. */
export interface Room {
  floor: number
  room: number
  kind: RoomKind
  shape: string
  size: string
  elevation: number
  lighting: string
  exits: number
  /** Which doorway (1..exits) actually leads on. */
  trueExit: number
  terrain: string[]
  /** Indexes into the floor's flavor details. */
  flavor: number[]
  /** Index into the oddities, or null for most rooms. */
  oddity: number | null
  tricks: PlacedTrick[]
  /** d20 roll of the room's secret condition (non-boss, non-Reprieve rooms). */
  condition: number | null
  /** What the DM has shown players so far. */
  revealed: { trueExit: boolean; falseWall: boolean; oddity: boolean; condition: boolean }
  /** Combat and elite rooms: the generated fight. */
  encounter?: Encounter | null
  /** Boss rooms: which boss, and the living party size it was built for. */
  boss?: { id: string; partySize: number } | null
  /**
   * Shift Actions in play, by the boss they belong to: the boss's own in a boss
   * room, or Restless Stone's in other rooms. Hidden until triggered.
   */
  shifts?: { bossId: string; revealed: boolean }[]
  /** HP tracking (DM only): damage taken and the boss's Bloodied override. */
  hp?: HpState
  /** The Bloodied facts players may see, refreshed on every save (see roomFlow). */
  hpShown?: HpShown
  /** Combat and elite rooms: the battle map (DM only for now). */
  map?: BattleMap | null
}

const roll =(sides: number, random: Random) => 1 + Math.floor(random() * sides)
const pick = <T,>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]

// ---------------------------------------------------------------------------
// Floor plans: which rooms are elite or the Reprieve (DM-only).

/**
 * Plan a floor's 4 rooms when it starts. Each room has a 1 in 4 chance to be
 * elite (at most 2, never floor 1 room 1). Each Reprieve owner rolls their
 * chance; any success makes room 2 or 3 the floor's single Reprieve.
 */
export function planFloor(floor: number, roomCount: number, reprieveRanks: number[], random: Random): RoomKind[] {
  const plan: RoomKind[] = []
  let elites = 0
  for (let room = 1; room <= roomCount; room++) {
    const canBeElite = !(floor === 1 && room === 1) && elites < rules.maxElitePerFloor
    const elite = canBeElite && roll(rules.eliteChanceOneIn, random) === 1
    if (elite) elites++
    plan.push(elite ? 'elite' : 'combat')
  }
  const reprieve = reprieveRanks.some((rank) => rank > 0 && random() * 100 < upgrades.reprieveChancePercent[rank - 1])
  if (reprieve && roomCount >= 3) plan[roll(2, random)] = 'reprieve' // index 1 or 2: room 2 or 3
  return plan
}

// ---------------------------------------------------------------------------
// Rolling a room.

function rollShape(floor: number, random: Random) {
  for (;;) {
    const r = roll(8, random)
    const shape = SHAPES.find((s) => s.roll === r)!
    if (!shape.minFloor || floor >= shape.minFloor) return shape.id
  }
}

function terrainAllowed(t: (typeof TERRAIN)[number], floor: number): boolean {
  if (t.minFloor && floor < t.minFloor) return false
  if (t.onlyFloor && floor !== t.onlyFloor) return false
  return true
}

/** One terrain roll: "roll twice" combines two more rolls. */
function rollTerrainOnce(floor: number, random: Random, depth = 0): string[] {
  for (;;) {
    const r = roll(20, random)
    const t = TERRAIN.find((x) => x.roll === r)!
    if (t.rollTwice) {
      if (depth > 2) continue
      return [...rollTerrainOnce(floor, random, depth + 1), ...rollTerrainOnce(floor, random, depth + 1)]
    }
    if (terrainAllowed(t, floor)) return [t.id]
  }
}

/** Two or three terrain rolls; a "roll twice" result brings two features. Repeats collapse. */
function rollTerrain(floor: number, random: Random): string[] {
  const { min, max } = layouts.terrainCount
  const rolls = min + Math.floor(random() * (max - min + 1))
  const features = new Set<string>()
  for (let i = 0; i < rolls; i++) for (const id of rollTerrainOnce(floor, random)) features.add(id)
  return [...features]
}

function rollLighting(floor: number, random: Random): string {
  const r = roll(6, random)
  if (floor === 4 && layouts.floor4GoldenLight.rolls.includes(r)) return layouts.floor4GoldenLight.id
  return layouts.lighting.find((l) => l.rolls.includes(r))!.id
}

/** How many tricks a room gets (d6 by floor; elite +1; Reprieve and boss rooms none). */
export function trickCount(floor: number, kind: RoomKind, random: Random): number {
  if (kind === 'reprieve' || kind === 'boss') return 0
  const row = trickData.frequency.find((f) => f.floor === Math.min(floor, 4))!
  const r = roll(6, random)
  const base = row.table.find((t) => r <= t.upTo)!.count
  return base + (kind === 'elite' ? trickData.eliteExtraTricks : 0)
}

/** Draw a trick: usually the current floor's list; from floor 2, 1 in 3 from an earlier floor. */
function drawTrick(floor: number, exclude: Set<string>, random: Random): string | null {
  const f = Math.min(floor, 4)
  const earlier = f >= 2 && roll(trickData.earlierFloorChanceOneIn, random) === 1
  const pool = TRICKS.filter((t) => (earlier ? t.floor < f : t.floor === f) && !exclude.has(t.id))
  const fallback = TRICKS.filter((t) => t.floor <= f && !exclude.has(t.id))
  const from = pool.length ? pool : fallback
  return from.length ? pick(from, random).id : null
}

function distinctIndexes(count: number, size: number, random: Random): number[] {
  const all = Array.from({ length: size }, (_, i) => i)
  const out: number[] = []
  while (out.length < Math.min(count, size)) out.push(all.splice(Math.floor(random() * all.length), 1)[0])
  return out
}

/** Generate a room. Boss rooms are always large, with no tricks or secret condition. */
export function generateRoom(floor: number, room: number, kind: RoomKind, random: Random): Room {
  const exits = roll(layouts.maxExits, random)
  const tricks: PlacedTrick[] = []
  const placed = new Set<string>()
  for (let i = trickCount(floor, kind, random); i > 0; i--) {
    const id = drawTrick(floor, placed, random)
    if (id) {
      placed.add(id)
      tricks.push({ id, revealed: false })
    }
  }
  const flavorFloor = flavor.floors.find((f) => f.floor === Math.min(floor, 4)) ?? flavor.floors[0]
  return {
    floor,
    room,
    kind,
    shape: rollShape(floor, random),
    size: kind === 'boss' ? 'large' : pick(layouts.sizes, random).id,
    elevation: roll(4, random),
    lighting: rollLighting(floor, random),
    exits,
    trueExit: roll(exits, random),
    terrain: rollTerrain(floor, random),
    flavor: distinctIndexes(flavor.detailsPerRoom, flavorFloor.details.length, random),
    oddity: roll(flavor.oddityChanceOneIn, random) === 1 ? Math.floor(random() * flavor.oddities.length) : null,
    tricks,
    condition: kind === 'boss' || kind === 'reprieve' ? null : roll(20, random),
    revealed: { trueExit: false, falseWall: false, oddity: false, condition: false },
  }
}

// ---------------------------------------------------------------------------
// Reading a room: names, numbers and the player view.

export const shapeOf = (id: string) => SHAPES.find((s) => s.id === id)!
export const sizeOf = (id: string) => layouts.sizes.find((s) => s.id === id)!
export const elevationOf = (r: number) => layouts.elevations.find((e) => e.roll === r)!
export const terrainOf = (id: string) => TERRAIN.find((t) => t.id === id)!
export const trickOf = (id: string) => TRICKS.find((t) => t.id === id)!
export const conditionOf = (r: number) => CONDITIONS.find((c) => c.roll === r)!

export function lightingName(id: string): string {
  if (id === layouts.floor4GoldenLight.id) return layouts.floor4GoldenLight.name
  return layouts.lighting.find((l) => l.id === id)?.name ?? id
}

export function flavorText(room: Pick<Room, 'floor' | 'flavor'>): string[] {
  const floor = flavor.floors.find((f) => f.floor === Math.min(room.floor, 4)) ?? flavor.floors[0]
  return room.flavor.map((i) => floor.details[i])
}

export function oddityText(index: number): string {
  return flavor.oddities[index]
}

/** Trick save DC and damage dice for a party level on a floor. */
export function trickNumbers(floor: number, partyLevel: number): { dc: number; damage: string } {
  const pb = proficiencyBonus(partyLevel)
  const die = (trickData.damageDie as Record<string, string>)[String(Math.min(floor, 4))]
  return { dc: 10 + pb + floor, damage: `${pb}${die}` }
}

export function trueExitDC(floor: number): number {
  return layouts.trueExitBaseDC + floor
}

/** What players may see of a room (Player view visibility). */
export interface RoomView {
  floor: number
  room: number
  kind: RoomKind
  shape: string
  size: string
  elevation: number
  lighting: string
  exits: number
  /** Visible terrain; the false wall only once revealed. */
  terrain: string[]
  flavor: number[]
  trueExit: number | null
  oddity: number | null
  /** Revealed (or sprung) tricks only. */
  tricks: string[]
  /** The secret condition, only once met or revealed. */
  condition: number | null
  /** Revealed enemies: names, counts and how many are Bloodied; never stats. */
  enemies?: { creatureId: string; count: number; bloodied?: number }[]
  /** The boss's name is shown once its room starts. */
  bossId?: string | null
  /** The boss is Bloodied (players see this, never its HP). */
  bossBloodied?: boolean
  /** Shift Actions the DM has triggered, by the boss they belong to. */
  shifts?: string[]
}

export function playerView(room: Room): RoomView {
  const hiddenTerrain = new Set(TERRAIN.filter((t) => t.hidden).map((t) => t.id))
  return {
    floor: room.floor,
    room: room.room,
    kind: room.kind,
    shape: room.shape,
    size: room.size,
    elevation: room.elevation,
    lighting: room.lighting,
    exits: room.exits,
    terrain: room.terrain.filter((id) => !hiddenTerrain.has(id) || room.revealed.falseWall),
    flavor: room.flavor,
    trueExit: room.revealed.trueExit ? room.trueExit : null,
    oddity: room.revealed.oddity ? room.oddity : null,
    tricks: room.tricks.filter((t) => t.revealed).map((t) => t.id),
    condition: room.revealed.condition ? room.condition : null,
    enemies: encounterView(room.encounter, room.hpShown?.enemyBloodied),
    bossId: room.boss?.id ?? null,
    bossBloodied: Boolean(room.boss && room.hpShown?.boss),
    shifts: (room.shifts ?? []).filter((s) => s.revealed).map((s) => s.bossId),
  }
}
