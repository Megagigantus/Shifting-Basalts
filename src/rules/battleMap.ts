// The battle map for combat and elite rooms (design bible: Size, elevation,
// exits and lighting; docs/battle-map-plan.md). The room's size sets the grid;
// the app places doorways, terrain, tricks and enemies on it when the room is
// generated, and the DM can drag any piece. Pure functions with a
// controllable `random`, like the other generators. The map lives in the
// DM-only room; players don't see it yet.
import mapData from '../data/battle-map.json'
import arenaData from '../data/arenas.json'
import { creatureOf } from './encounters'
import type { Random } from './draft'
import type { Room } from './rooms'

export type Side = 'north' | 'south' | 'east' | 'west'
export type PieceKind = 'exit' | 'terrain' | 'trick' | 'enemy' | 'boss' | 'object'

/** One thing on the map. x and y are the top-left square (0 = north / west). */
export interface MapPiece {
  /** Unique on the map. Enemies use their HP tracker key, e.g. "enemy:0:1". */
  key: string
  kind: PieceKind
  /**
   * Terrain or trick id, creature id, or the exit number for doorways. Boss
   * tokens: their art ("bosses:<id>" or "boss-parts:<id>"). Objects: their
   * art in src/art/objects.
   */
  id: string
  x: number
  y: number
  /** Squares per side: 1 Medium, 2 Large, 3 Huge; 0.5 for Tiny. */
  size: number
  /** Rectangles (objects like a 2 x 1 wall): width and height in squares. */
  w?: number
  h?: number
  /** Boss tokens: the HP tracker they follow ("boss" or "part:<name>:<n>"). */
  hp?: string
  /** Shown only in this boss phase (1, or 2 from Bloodied). */
  phase?: number
  /** Boss tokens and objects: what to call it. */
  name?: string
}

/** A painted feature outlined on the map (a ledge, a track, a portal). */
export interface MapArea {
  key: string
  kind: string
  name: string
  x: number
  y: number
  w: number
  h: number
  phase?: number
}

export interface BattleMap {
  /** Squares per side (the map is square). */
  squares: number
  /** The edge the party comes in from. */
  entrance: Side
  pieces: MapPiece[]
  /** Boss arenas: the boss whose arena this is. */
  arena?: string
  /** Boss arenas: the entrance squares (instead of the middle of the entrance edge). */
  door?: { x: number; y: number; w: number; h: number }
  /** Boss arenas: painted features, outlined. */
  areas?: MapArea[]
}

const TRICK_TERRAIN = mapData.trickTerrain as Record<string, { features: string[]; shapes: string[] }>
const AVOID = mapData.avoid as Record<string, { x: number; y: number; w: number; h: number }[]>

/** Squares whose centre falls in a painted no-placement area (a chasm, a pit) for this shape. */
export function avoidSquares(shape: string, n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (const r of AVOID[shape] ?? []) {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const cx = (x + 0.5) / n
        const cy = (y + 0.5) / n
        if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) out.push({ x, y })
      }
  }
  return out
}

export const roomSquares = (size: string) => (mapData.roomSquares as Record<string, number>)[size] ?? 10
export const entranceSide = (shape: string): Side =>
  ((mapData.entrance.shapes as Record<string, string>)[shape] ?? mapData.entrance.default) as Side
export const sizeSquares = (size: string) => (mapData.sizeSquares as Record<string, number>)[size] ?? 1
/** Squares a piece blocks on the grid: at least 1 (Tiny creatures still take a square here). */
export const footprint = (p: Pick<MapPiece, 'size'>) => Math.max(1, Math.ceil(p.size))
/** Width and height in squares (rectangles for some objects, else the footprint). */
export const dims = (p: Pick<MapPiece, 'size' | 'w' | 'h'>) => ({ w: p.w ?? footprint(p), h: p.h ?? footprint(p) })

/** The squares the party enters on: an arena's door, or the middle of the entrance edge. */
export function doorSquares(map: Pick<BattleMap, 'squares' | 'entrance' | 'door'>): { x: number; y: number }[] {
  if (!map.door) return entranceSquares(map.squares, map.entrance)
  const out: { x: number; y: number }[] = []
  for (let y = map.door.y; y < map.door.y + map.door.h; y++) for (let x = map.door.x; x < map.door.x + map.door.w; x++) out.push({ x, y })
  return out
}

/** Whether a piece or area shows in this phase (no phase = always). */
export const inPhase = (p: { phase?: number }, phase: number) => p.phase === undefined || p.phase === phase

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
  if (room.kind === 'boss') return placeArena(room)
  if (room.kind !== 'combat' && room.kind !== 'elite') return null
  const n = roomSquares(room.size)
  const entrance = entranceSide(room.shape)
  const grid = new Grid(n)
  const inside = { x0: 1, y0: 1, x1: n - 2, y1: n - 2 }
  for (const sq of entranceSquares(n, entrance)) grid.mark(sq.x, sq.y, 1)
  for (const sq of avoidSquares(room.shape, n)) grid.mark(sq.x, sq.y, 1)

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

// ---------------------------------------------------------------------------
// Boss arenas (arenas.json): a fixed layout per boss, on a 14 x 14 grid.

interface ArenaData {
  entrance: { x: number; y: number; w: number; h: number }
  tokens: { name: string; size: number; art: string; hp: string; x: number; y: number; note?: string; forms?: Record<string, string> }[]
  objects: { art: string; name: string; x: number; y: number; w: number; h: number; phase?: number; note?: string }[]
  areas: { kind: string; name: string; x: number; y: number; w: number; h: number; phase?: number }[]
  phase2?: boolean
  notes?: string
}
const ARENAS = arenaData.arenas as Record<string, ArenaData>
export const PALETTE = arenaData.palette as { art: string; name: string; w: number; h: number }[]
export const arenaOf = (bossId: string): ArenaData | undefined => ARENAS[bossId]

/** Optional fields only when set (Firestore can't store undefined). */
const withPhase = <T extends object>(obj: T, phase?: number): T & { phase?: number } => (phase === undefined ? obj : { ...obj, phase })

/** Lay out a boss room from its arena: boss tokens, objects and painted areas. */
export function placeArena(room: Room): BattleMap | null {
  const bossId = room.boss?.id
  const arena = bossId ? ARENAS[bossId] : undefined
  if (!bossId || !arena) return null
  const pieces: MapPiece[] = [
    ...arena.tokens.map((t, i) => {
      const piece: MapPiece = { key: `boss:${i}`, kind: 'boss', id: t.art, x: t.x, y: t.y, size: t.size, hp: t.hp, name: t.name }
      return piece
    }),
    ...arena.objects.map((o, i) =>
      withPhase({ key: `obj:${i}`, kind: 'object' as const, id: o.art, x: o.x, y: o.y, size: 1, w: o.w, h: o.h, name: o.name }, o.phase),
    ),
  ]
  const areas: MapArea[] = arena.areas.map((a, i) => withPhase({ key: `area:${i}`, kind: a.kind, name: a.name, x: a.x, y: a.y, w: a.w, h: a.h }, a.phase))
  return { squares: arenaData.squares, entrance: 'south', door: arena.entrance, arena: bossId, pieces, areas }
}

/** Whether a boss arena has a second phase (art and pieces that change at Bloodied). */
export function arenaHasPhase2(bossId: string | undefined | null): boolean {
  const arena = bossId ? ARENAS[bossId] : undefined
  return Boolean(arena && (arena.phase2 || arena.areas.some((a) => a.phase === 2) || arena.objects.some((o) => o.phase === 2)))
}

/** The arena phase to show: 2 once the boss is Bloodied (if its arena has a phase 2), else 1. */
export const mapPhase = (map: Pick<BattleMap, 'arena'> | null | undefined, bossBloodied: boolean) =>
  map?.arena && bossBloodied && arenaHasPhase2(map.arena) ? 2 : 1

/** Kaelen and Vyr: swap the boss token's art to the other form. */
export function swapForm(map: BattleMap): BattleMap {
  const arena = map.arena ? ARENAS[map.arena] : undefined
  let changed = false
  const pieces = map.pieces.map((p) => {
    if (p.kind !== 'boss') return p
    const forms = arena?.tokens[Number(p.key.split(':')[1])]?.forms
    if (!forms) return p
    const all = Object.values(forms)
    const next = all[(all.indexOf(p.id) + 1) % all.length]
    changed = true
    return { ...p, id: next }
  })
  if (!changed) throw new Error('This boss has no forms to swap.')
  return { ...map, pieces }
}

/** Which form a form-swapping boss is in (e.g. "kaelen"), or null. */
export function currentForm(map: BattleMap | null | undefined): string | null {
  const arena = map?.arena ? ARENAS[map.arena] : undefined
  for (const p of map?.pieces ?? []) {
    const forms = p.kind === 'boss' ? arena?.tokens[Number(p.key.split(':')[1])]?.forms : undefined
    const hit = forms && Object.entries(forms).find(([, art]) => art === p.id)
    if (hit) return hit[0]
  }
  return null
}

/** The DM drops an object from the palette near the middle of the map. */
export function addObject(map: BattleMap, art: string): BattleMap {
  const item = PALETTE.find((p) => p.art === art)
  if (!item) throw new Error('That object isn\'t in the palette.')
  const used = map.pieces.filter((p) => p.key.startsWith('drop:')).map((p) => Number(p.key.slice(5)))
  const key = `drop:${used.length ? Math.max(...used) + 1 : 1}`
  const x = Math.max(0, Math.floor((map.squares - item.w) / 2))
  const y = Math.max(0, Math.floor((map.squares - item.h) / 2))
  return { ...map, pieces: [...map.pieces, { key, kind: 'object', id: art, x, y, size: 1, w: item.w, h: item.h, name: item.name }] }
}

/** The DM removes an object (dropped or part of the arena). */
export function removeObject(map: BattleMap, key: string): BattleMap {
  const piece = map.pieces.find((p) => p.key === key)
  if (!piece || piece.kind !== 'object') throw new Error('Only objects can be removed.')
  return { ...map, pieces: map.pieces.filter((p) => p.key !== key) }
}

/** A piece as players see it: no hidden things, and for enemies only Bloodied or Down. */
export interface PlayerPiece extends MapPiece {
  state: 'bloodied' | 'down' | null
}

export interface PlayerMap {
  squares: number
  entrance: Side
  pieces: PlayerPiece[]
  arena?: string
  door?: BattleMap['door']
  areas?: MapArea[]
}

/**
 * The battle map players may see (bible: Player view visibility). Doorways
 * always; terrain except an unfound false wall; only revealed tricks; only
 * revealed enemies; in boss arenas, the boss's tokens, objects and painted
 * areas (the boss is shown once its room starts). Which doorway is the true
 * exit comes from the room view's own trueExit (null until revealed), never
 * from the map.
 */
export function playerMap(room: Room): PlayerMap | null {
  const map = room.map
  if (!map) return null
  const marks = room.hpShown?.tokens ?? {}
  const shown = (p: MapPiece): boolean => {
    if (p.kind === 'exit' || p.kind === 'boss' || p.kind === 'object') return true
    if (p.kind === 'terrain') return p.id !== 'false-wall' || room.revealed.falseWall
    if (p.kind === 'trick') return Boolean(room.tricks.find((t) => t.id === p.id)?.revealed)
    const group = Number(p.key.split(':')[1])
    return Boolean(room.encounter?.groups[group]?.revealed)
  }
  const state = (p: MapPiece) => (p.kind === 'enemy' ? (marks[p.key] ?? null) : p.kind === 'boss' && p.hp ? (marks[p.hp] ?? null) : null)
  const out: PlayerMap = {
    squares: map.squares,
    entrance: map.entrance,
    pieces: map.pieces.filter(shown).map((p) => ({ ...p, state: state(p) })),
  }
  if (map.arena) out.arena = map.arena
  if (map.door) out.door = map.door
  if (map.areas) out.areas = map.areas
  return out
}

/**
 * Where player tokens start in a room: the entrance squares first, then the
 * nearest free squares going inward, skipping squares other pieces cover.
 */
export function startSquares(map: Pick<BattleMap, 'squares' | 'entrance' | 'pieces' | 'door'>, count: number): { x: number; y: number }[] {
  const n = map.squares
  const taken = new Set<string>()
  for (const p of map.pieces) {
    const { w, h } = dims(p)
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) taken.add(`${p.x + dx},${p.y + dy}`)
  }
  const out: { x: number; y: number }[] = []
  const seen = new Set<string>()
  const doors = doorSquares(map)
  const queue = [...doors]
  for (const q of queue) seen.add(`${q.x},${q.y}`)
  while (queue.length && out.length < count) {
    const q = queue.shift()!
    if (!taken.has(`${q.x},${q.y}`)) out.push(q)
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const nx = q.x + dx
      const ny = q.y + dy
      const k = `${nx},${ny}`
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || seen.has(k)) continue
      seen.add(k)
      queue.push({ x: nx, y: ny })
    }
  }
  // A packed room: stack the rest on the entrance.
  while (out.length < count) out.push(doors[out.length % doors.length])
  return out
}

/** Move one piece, kept on the grid. Pieces may share squares; the DM decides. */
export function movePiece(map: BattleMap, key: string, x: number, y: number): BattleMap {
  const piece = map.pieces.find((p) => p.key === key)
  if (!piece) throw new Error('That piece isn\'t on the map.')
  const { w, h } = dims(piece)
  const cx = Math.min(map.squares - w, Math.max(0, Math.round(x)))
  const cy = Math.min(map.squares - h, Math.max(0, Math.round(y)))
  if (cx === piece.x && cy === piece.y) return map
  return { ...map, pieces: map.pieces.map((p) => (p.key === key ? { ...p, x: cx, y: cy } : p)) }
}
