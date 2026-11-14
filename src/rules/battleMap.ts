// The battle map for combat and elite rooms (design bible: Size, elevation,
// exits and lighting; docs/battle-map-plan.md). The room's size sets the grid;
// the app places doorways, terrain, tricks and enemies on it when the room is
// generated, and the DM can drag any piece. Pure functions with a
// controllable `random`, like the other generators. The map lives in the
// DM-only room; players don't see it yet.
import mapData from '../data/battle-map.json'
import { creatureOf } from './encounters'
import type { Random } from './draft'
import type { Room } from './rooms'

export type Side = 'north' | 'south' | 'east' | 'west'
export type PieceKind = 'exit' | 'terrain' | 'trick' | 'enemy'

/** One thing on the map. x and y are the top-left square (0 = north / west). */
export interface MapPiece {
  /** Unique on the map. Enemies use their HP tracker key, e.g. "enemy:0:1". */
  key: string
  kind: PieceKind
  /** Terrain or trick id, creature id, or the exit number for doorways. */
  id: string
  x: number
  y: number
  /** Squares per side: 1 Medium, 2 Large, 3 Huge; 0.5 for Tiny. */
  size: number
}

export interface BattleMap {
  /** Squares per side (the map is square). */
  squares: number
  /** The edge the party comes in from. */
  entrance: Side
  pieces: MapPiece[]
}

const TRICK_TERRAIN = mapData.trickTerrain as Record<string, { features: string[]; shapes: string[] }>

export const roomSquares = (size: string) => (mapData.roomSquares as Record<string, number>)[size] ?? 10
export const entranceSide = (shape: string): Side =>
  ((mapData.entrance.shapes as Record<string, string>)[shape] ?? mapData.entrance.default) as Side
export const sizeSquares = (size: string) => (mapData.sizeSquares as Record<string, number>)[size] ?? 1
/** Squares a piece blocks on the grid: at least 1 (Tiny creatures still take a square here). */
export const footprint = (p: Pick<MapPiece, 'size'>) => Math.max(1, Math.ceil(p.size))

const OTHER_SIDES: Record<Side, Side[]> = {
  south: ['north', 'east', 'west'],
  north: ['south', 'east', 'west'],
  east: ['west', 'north', 'south'],
  west: ['east', 'north', 'south'],
}

/** The two middle squares on the entrance edge and the row (or column) just inside it. */
export function entranceSquares(n: number, side: Side): { x: number; y: number }[] {
  const mid = Math.floor(n / 2) - 1
  const out: { x: number; y: number }[] = []
  for (const a of [mid, mid + 1]) {
    for (const depth of [0, 1]) {
      if (side === 'south') out.push({ x: a, y: n - 1 - depth })
      if (side === 'north') out.push({ x: a, y: depth })
      if (side === 'east') out.push({ x: n - 1 - depth, y: a })
      if (side === 'west') out.push({ x: depth, y: a })
    }
  }
  return out
}

class Grid {
  readonly n: number
  private used: boolean[]
  constructor(n: number) {
    this.n = n
    this.used = Array(n * n).fill(false)
  }
  fits(x: number, y: number, s: number): boolean {
    if (x < 0 || y < 0 || x + s > this.n || y + s > this.n) return false
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (this.used[(y + dy) * this.n + x + dx]) return false
    return true
  }
  mark(x: number, y: number, s: number) {
    for (let dy = 0; dy < s; dy++)
      for (let dx = 0; dx < s; dx++) {
        const cx = x + dx
        const cy = y + dy
        if (cx >= 0 && cy >= 0 && cx < this.n && cy < this.n) this.used[cy * this.n + cx] = true
      }
  }
}

const pickOne = <T,>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]

/** Every top-left square in a box where a piece of side `s` fits. */
function spots(grid: Grid, s: number, box: { x0: number; y0: number; x1: number; y1: number }) {
  const out: { x: number; y: number }[] = []
  for (let y = box.y0; y <= box.y1 - s + 1; y++) for (let x = box.x0; x <= box.x1 - s + 1; x++) if (grid.fits(x, y, s)) out.push({ x, y })
  return out
}

/**
 * Put a piece on the first list of candidate squares that has room, falling
 * back to anywhere free, then to any in-bounds square (pieces may overlap
 * only when the room is full; the DM can sort it out by dragging).
 */
function put(grid: Grid, s: number, tries: { x: number; y: number }[][], random: Random): { x: number; y: number } {
  for (const list of tries) {
    const ok = list.filter((p) => grid.fits(p.x, p.y, s))
    if (ok.length) {
      const p = pickOne(ok, random)
      grid.mark(p.x, p.y, s)
      return p
    }
  }
  const any = spots(grid, s, { x0: 0, y0: 0, x1: grid.n - 1, y1: grid.n - 1 })
  const p = any.length ? pickOne(any, random) : { x: Math.floor(random() * Math.max(1, grid.n - s + 1)), y: Math.floor(random() * Math.max(1, grid.n - s + 1)) }
  grid.mark(p.x, p.y, s)
  return p
}

/** Squares along one edge (the wall row or column), skipping the corners. */
function edgeSquares(n: number, side: Side): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let a = 1; a < n - 1; a++) {
    if (side === 'north') out.push({ x: a, y: 0 })
    if (side === 'south') out.push({ x: a, y: n - 1 })
    if (side === 'west') out.push({ x: 0, y: a })
    if (side === 'east') out.push({ x: n - 1, y: a })
  }
  return out
}

/** The half of the room away from the entrance, inside the walls. */
function farHalf(n: number, side: Side) {
  const half = Math.floor(n / 2)
  if (side === 'south') return { x0: 1, y0: 1, x1: n - 2, y1: half - 1 }
  if (side === 'north') return { x0: 1, y0: half, x1: n - 2, y1: n - 2 }
  if (side === 'east') return { x0: 1, y0: 1, x1: half - 1, y1: n - 2 }
  return { x0: half, y0: 1, x1: n - 2, y1: n - 2 }
}

const near = (grid: Grid, s: number, cx: number, cy: number, r: number) =>
  spots(grid, s, { x0: Math.max(1, cx - r), y0: Math.max(1, cy - r), x1: Math.min(grid.n - 2, cx + r), y1: Math.min(grid.n - 2, cy + r) })

/**
 * Lay out a combat or elite room. With `keep`, the doorways, terrain and
 * tricks stay where they are (e.g. after rerolling only the encounter) and
 * just the enemies are placed again.
 */
export function placeMap(room: Room, random: Random, keep?: BattleMap | null): BattleMap | null {
  if (room.kind !== 'combat' && room.kind !== 'elite') return null
  const n = roomSquares(room.size)
  const entrance = entranceSide(room.shape)
  const grid = new Grid(n)
  const inside = { x0: 1, y0: 1, x1: n - 2, y1: n - 2 }
  for (const sq of entranceSquares(n, entrance)) grid.mark(sq.x, sq.y, 1)

  const kept = keep && keep.squares === n ? keep.pieces.filter((p) => p.kind !== 'enemy') : null
  const pieces: MapPiece[] = []
  if (kept) {
    for (const p of kept) {
      grid.mark(p.x, p.y, footprint(p))
      pieces.push(p)
    }
  } else {
    // Doorways: spread over the other three edges, starting with the far one.
    const sides = OTHER_SIDES[entrance]
    for (let i = 0; i < room.exits; i++) {
      const side = sides[i % sides.length]
      const p = put(grid, 1, [edgeSquares(n, side).filter((q) => Math.abs((side === 'north' || side === 'south' ? q.x : q.y) - n / 2) < n / 3)], random)
      pieces.push({ key: `exit:${i + 1}`, kind: 'exit', id: String(i + 1), x: p.x, y: p.y, size: 1 })
    }
    // Terrain: on open floor inside the walls; the false wall goes in a wall.
    for (const id of room.terrain) {
      const tries = id === 'false-wall' ? sides.map((s) => edgeSquares(n, s)) : [spots(grid, 1, inside)]
      const p = put(grid, 1, tries, random)
      pieces.push({ key: `terrain:${id}`, kind: 'terrain', id, x: p.x, y: p.y, size: 1 })
    }
    // Tricks: near terrain they fit (battle-map.json trickTerrain), else anywhere inside.
    for (const t of room.tricks) {
      const pref = TRICK_TERRAIN[t.id]
      const homes = pieces.filter((p) => p.kind === 'terrain' && pref?.features.includes(p.id))
      const close = homes.flatMap((h) => near(grid, 1, h.x, h.y, 2))
      const p = put(grid, 1, [close, spots(grid, 1, inside)], random)
      pieces.push({ key: `trick:${t.id}`, kind: 'trick', id: t.id, x: p.x, y: p.y, size: 1 })
    }
  }

  // Enemies: in the far half, each group kept together.
  const far = farHalf(n, entrance)
  room.encounter?.groups.forEach((g, gi) => {
    const size = sizeSquares(creatureOf(g.creatureId).size)
    const s = Math.max(1, Math.ceil(size))
    let anchor: { x: number; y: number } | null = null
    for (let k = 0; k < g.count; k++) {
      const tries = anchor ? [near(grid, s, anchor.x, anchor.y, 2), spots(grid, s, far), spots(grid, s, inside)] : [spots(grid, s, far), spots(grid, s, inside)]
      const p = put(grid, s, tries, random)
      anchor ??= p
      pieces.push({ key: `enemy:${gi}:${k}`, kind: 'enemy', id: g.creatureId, x: p.x, y: p.y, size })
    }
  })
  return { squares: n, entrance, pieces }
}

/** Move one piece, kept on the grid. Pieces may share squares; the DM decides. */
export function movePiece(map: BattleMap, key: string, x: number, y: number): BattleMap {
  const piece = map.pieces.find((p) => p.key === key)
  if (!piece) throw new Error('That piece isn\'t on the map.')
  const s = footprint(piece)
  const cx = Math.min(map.squares - s, Math.max(0, Math.round(x)))
  const cy = Math.min(map.squares - s, Math.max(0, Math.round(y)))
  if (cx === piece.x && cy === piece.y) return map
  return { ...map, pieces: map.pieces.map((p) => (p.key === key ? { ...p, x: cx, y: cy } : p)) }
}
