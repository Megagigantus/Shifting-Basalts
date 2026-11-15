// The Closing Ring Pressure (design bible: Pressures). In fight rooms the
// outer ring of the battle map is hazardous terrain that grows inward on a
// round schedule. The ring's settings come from src/data/pressures.json; the
// room keeps the current round and how deep the ring is. Nothing here is
// hidden: players see the ring on their map too.
import { PRESSURES, type Pressure } from './run'
import { sizeOf, trickNumbers, type Room } from './rooms'

export type RingSettings = NonNullable<Pressure['ring']>

/** The fight's round and how many squares deep the hazardous ring is. */
export interface RingState {
  round: number
  width: number
}

/** The ring settings for the run's Pressures, or null without Closing Ring. Closing Ring II wins over the base. */
export function ringSettings(pressures: string[]): RingSettings | null {
  const picked = PRESSURES.filter((p) => p.ring && pressures.includes(p.id)).sort((a, b) => b.unlockRank - a.unlockRank)
  return picked[0]?.ring ?? null
}

/** Rooms the ring applies to: the ones with a fight and a battle map. */
export function hasRing(room: Pick<Room, 'kind'>): boolean {
  return room.kind === 'combat' || room.kind === 'elite' || room.kind === 'boss'
}

/** Squares per side of the room's map (from the map, or the room's size). */
export function squaresAcross(room: Pick<Room, 'size' | 'map'>): number {
  return room.map?.squares ?? Math.round(sizeOf(room.size).feet / 5)
}

/** The deepest the ring can get: it always leaves the safe centre clear. */
export function maxWidth(squares: number, ring: RingSettings): number {
  return Math.max(0, Math.floor((squares - ring.safeCentreSquares) / 2))
}

/** The ring when a fight begins: round 1, at its starting depth. */
export function startRing(room: Pick<Room, 'kind' | 'size' | 'map'>, pressures: string[]): RingState | null {
  const ring = ringSettings(pressures)
  if (!ring || !hasRing(room)) return null
  return { round: 1, width: Math.min(ring.startSquares, maxWidth(squaresAcross(room), ring)) }
}

/** The room's saved ring, or a fresh one for rooms made before the ring was tracked. */
export function ringOf(room: Room, pressures: string[]): RingState | null {
  if (!ringSettings(pressures) || !hasRing(room)) return null
  return room.ring ?? startRing(room, pressures)
}

/** The round the ring next grows on (rounds 3, 6, 9 for every 3). */
export function nextGrowthRound(round: number, ring: RingSettings): number {
  return (Math.floor(round / ring.everyRounds) + 1) * ring.everyRounds
}

/** Move to the next round; the ring grows when that round is on its schedule. */
export function nextRound(state: RingState, ring: RingSettings, squares: number): RingState {
  const round = state.round + 1
  const grows = round % ring.everyRounds === 0
  return { round, width: grows ? Math.min(state.width + ring.growSquares, maxWidth(squares, ring)) : state.width }
}

/** The DM grows the ring by hand (a correction, or a room effect). */
export function advanceRing(state: RingState, ring: RingSettings, squares: number): RingState {
  return { ...state, width: Math.min(state.width + ring.growSquares, maxWidth(squares, ring)) }
}

/** The DM pulls the ring back by hand. */
export function pullBackRing(state: RingState, ring: RingSettings): RingState {
  return { ...state, width: Math.max(0, state.width - ring.growSquares) }
}

/** Is this square inside the ring? */
export function inRing(x: number, y: number, squares: number, width: number): boolean {
  return x < width || y < width || x >= squares - width || y >= squares - width
}

/** What the ring does to a creature, with the floor's trick damage (e.g. PB d6 force). */
export function ringHazardText(ring: RingSettings, floor: number, partyLevel: number): string {
  const { damage } = trickNumbers(floor, partyLevel)
  return ring.hazardText.replace(/\{damage\}/g, damage).replace(/\{type\}/g, ring.damageType)
}

/** One line for the room cards, e.g. "Outer 10 ft is hazardous terrain (round 4). It grows at round 6." */
export function ringSummary(state: RingState, ring: RingSettings, squares: number): string {
  const depth = state.width === 0 ? 'The ring hasn\'t closed in yet' : `The outer ${state.width * 5} ft is hazardous terrain`
  const atMax = state.width >= maxWidth(squares, ring)
  const next = atMax ? 'It can\'t close in any further.' : `It grows at the start of round ${nextGrowthRound(state.round, ring)}.`
  return `${depth} (round ${state.round}). ${next}`
}
