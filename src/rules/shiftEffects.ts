// Shared shift plan engine for boss arena Shift Actions. Pure rules functions
// compute the new map, any character/summon token moves, whether a save gates
// those moves, and short DM notes.
import {
  PALETTE,
  dims,
  doorSquares,
  inPhase,
  isFloorObject,
  marchColumns,
  mirrorMap,
  mirrorSpot,
  type BattleMap,
  type MapArea,
  type ShiftEffect,
} from './battleMap'

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export const DIRECTIONS: readonly { dir: Direction; dx: number; dy: number }[] = [
  { dir: 'N', dx: 0, dy: -1 },
  { dir: 'NE', dx: 1, dy: -1 },
  { dir: 'E', dx: 1, dy: 0 },
  { dir: 'SE', dx: 1, dy: 1 },
  { dir: 'S', dx: 0, dy: 1 },
  { dir: 'SW', dx: -1, dy: 1 },
  { dir: 'W', dx: -1, dy: 0 },
  { dir: 'NW', dx: -1, dy: -1 },
]

export interface TokenPos {
  /** "pc:<characterId>" or "sm:<characterId>". */
  key: string
  x: number
  y: number
}

export interface TokenMove {
  key: string
  x: number
  y: number
}

export interface ShiftPlan {
  /** The map after the shift. */
  map: BattleMap
  /** Where affected tokens end up (only tokens that move). */
  moves: TokenMove[]
  /** Present when moves depend on a failed save; keys = tokens in the zone. */
  save?: { label: string; keys: string[] }
  /** Downhill direction for tilt effects, or fall direction for gravity effects. */
  direction?: Direction
  /** Chosen boss piece key for gravity effects. */
  anchor?: string
  /** Available boss pieces in this phase for gravity effects. */
  anchors?: { key: string; label: string }[]
  /** Short DM-facing notes, e.g. "Mira is pinned against the south wall". */
  notes: string[]
}

export interface ShiftContext {
  phase: number
  random: () => number
  direction?: Direction
  /** Boss piece key to anchor gravity effects to. */
  anchor?: string
  /** When set, only these token keys move (e.g. those who failed the save); the rest stay put and block. */
  only?: Set<string>
}

/**
 * Squares ("x,y") occupied in this phase by boss tokens, enemy tokens, and
 * non-floor object pieces, plus every token in `tokens` except `ignoreKey`.
 * Painted areas, exits, terrain, tricks, and floor objects never block
 * movement here.
 */
export function blockedSquares(
  map: BattleMap,
  phase: number,
  tokens: TokenPos[],
  ignoreKey?: string,
): Set<string> {
  const out = new Set<string>()
  for (const p of map.pieces) {
    if (p.key === ignoreKey) continue
    if (p.kind !== 'boss' && p.kind !== 'enemy' && p.kind !== 'object') continue
    if (p.kind === 'object' && isFloorObject(p.id)) continue
    if (!inPhase(p, phase)) continue
    const { w, h } = dims(p)
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        out.add(`${p.x + dx},${p.y + dy}`)
      }
    }
  }
  for (const t of tokens) {
    if (t.key !== ignoreKey) out.add(`${t.x},${t.y}`)
  }
  return out
}

/**
 * Slide one token up to `steps` squares by `(dx, dy)` (each -1, 0, or 1),
 * stopping before a blocked square or the grid edge.
 *
 * When sliding several tokens at once, process tokens nearest the destination
 * side first (e.g. largest `x * dx + y * dy` first), pass `ignoreKey` for the
 * moving token or remove its starting square from `blocked`, and add each
 * token's final square to `blocked` before sliding the next so two tokens
 * never end on the same square.
 */
export function slideToken(
  from: { x: number; y: number },
  dx: number,
  dy: number,
  steps: number,
  squares: number,
  blocked: Set<string>,
): { x: number; y: number; stoppedBy: 'edge' | 'blocked' | null } {
  let x = from.x
  let y = from.y
  for (let i = 0; i < steps; i++) {
    if (dx === 0 && dy === 0) break
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= squares || ny >= squares) {
      return { x, y, stoppedBy: 'edge' }
    }
    if (blocked.has(`${nx},${ny}`)) {
      return { x, y, stoppedBy: 'blocked' }
    }
    x = nx
    y = ny
  }
  return { x, y, stoppedBy: null }
}

function planConveyor(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'conveyor' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const n = map.squares
  const notes: string[] = []
  const nextPieces = map.pieces.map((p) => {
    if (p.kind === 'exit' || !inPhase(p, ctx.phase)) return p
    const { w, h } = dims(p)
    for (const s of effect.strips) {
      if (p.x >= s.x && p.x + w <= s.x + s.w) {
        let newY = (((p.y + s.dy * effect.squares) % n) + n) % n
        if (newY + h > n) newY = s.dy > 0 ? 0 : n - h
        return newY === p.y ? p : { ...p, y: newY }
      }
      if (p.x < s.x + s.w && p.x + w > s.x) {
        notes.push(`${p.name ?? p.key} straddles a conveyor strip and was not moved`)
        return p
      }
    }
    return p
  })

  const moves: TokenMove[] = []
  for (const t of tokens) {
    const s = effect.strips.find((strip) => t.x >= strip.x && t.x < strip.x + strip.w)
    if (!s) continue
    const newY = (((t.y + s.dy * effect.squares) % n) + n) % n
    if (newY !== t.y) moves.push({ key: t.key, x: t.x, y: newY })
  }

  return {
    map: { ...map, pieces: nextPieces },
    moves,
    notes,
  }
}

function planMarch(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'march' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const oldWalls = map.pieces.filter((p) => p.key.startsWith('march:'))
  const nextMap = marchColumns(map)
  const newWalls = nextMap.pieces.filter((p) => p.key.startsWith('march:'))
  const afterWallSquares = new Set(newWalls.map((w) => `${w.x},${w.y}`))
  const oldY = oldWalls.length > 0 ? oldWalls[0].y : null
  const newY = newWalls.length > 0 ? newWalls[0].y : effect.y

  const inWallCol = (x: number) => x >= effect.x && x < effect.x + effect.w
  const isCaught = (t: TokenPos) => {
    if (afterWallSquares.has(`${t.x},${t.y}`)) return true
    if (!inWallCol(t.x)) return false
    if (oldY === null) return t.y === newY
    return t.y >= oldY + 1 && t.y <= newY
  }

  const workingTokens = tokens.map((t) => ({ ...t }))
  const caught = tokens.filter(isCaught).sort((a, b) => b.y - a.y)
  const blocked = blockedSquares(nextMap, ctx.phase, tokens)
  const notes: string[] = []

  for (const t of caught) {
    let destY: number | null = null
    for (let y = newY + 1; y < nextMap.squares; y++) {
      if (!blocked.has(`${t.x},${y}`)) {
        destY = y
        break
      }
    }
    if (destY === null) {
      notes.push(`${t.key} is crushed against the south wall`)
    } else {
      blocked.add(`${t.x},${destY}`)
      const slot = workingTokens.find((w) => w.key === t.key)!
      slot.y = destY
    }
  }

  const moves: TokenMove[] = workingTokens.filter(
    (w, i) => w.x !== tokens[i].x || w.y !== tokens[i].y,
  )
  return {
    map: nextMap,
    moves,
    notes,
  }
}

function planMirror(map: BattleMap, tokens: TokenPos[]): ShiftPlan {
  const next = mirrorMap(map)
  const moves: TokenMove[] = tokens
    .map((t) => ({ key: t.key, x: t.x, y: mirrorSpot(t.y, 1, map.squares) }))
    .filter((m, i) => m.x !== tokens[i].x || m.y !== tokens[i].y)
  return {
    map: next,
    moves,
    notes: [],
  }
}

function planPush(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'push' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const within = effect.within ?? 0
  const affected =
    effect.zone === 'walls'
      ? tokens.filter(
          (t) =>
            t.x < within ||
            t.y < within ||
            t.x >= map.squares - within ||
            t.y >= map.squares - within,
        )
      : tokens

  let targetX = (map.squares - 1) / 2
  let targetY = (map.squares - 1) / 2
  if (effect.toward === 'boss') {
    const bosses = map.pieces.filter((p) => p.kind === 'boss' && inPhase(p, ctx.phase))
    const boss = bosses.find((p) => p.hp === 'boss') ?? bosses[0]
    if (boss) {
      const { w, h } = dims(boss)
      targetX = boss.x + (w - 1) / 2
      targetY = boss.y + (h - 1) / 2
    }
  }

  const workingTokens = tokens.map((t) => ({ ...t }))
  const sorted = affected.filter((t) => !ctx.only || ctx.only.has(t.key)).sort(
    (a, b) =>
      (a.x - targetX) ** 2 + (a.y - targetY) ** 2 - ((b.x - targetX) ** 2 + (b.y - targetY) ** 2),
  )
  const notes: string[] = []

  for (const t of sorted) {
    const blocked = blockedSquares(map, ctx.phase, workingTokens, t.key)
    let x = t.x
    let y = t.y
    let stoppedEarly = false
    for (let step = 0; step < effect.squares; step++) {
      const dx = Math.abs(targetX - x) < 1 ? 0 : Math.sign(targetX - x)
      const dy = Math.abs(targetY - y) < 1 ? 0 : Math.sign(targetY - y)
      if (dx === 0 && dy === 0) {
        stoppedEarly = true
        break
      }
      const res = slideToken({ x, y }, dx, dy, 1, map.squares, blocked)
      x = res.x
      y = res.y
      if (res.stoppedBy) {
        stoppedEarly = true
        break
      }
    }
    const slot = workingTokens.find((w) => w.key === t.key)!
    slot.x = x
    slot.y = y
    if (stoppedEarly) notes.push(`${t.key} stopped early`)
  }

  const moves: TokenMove[] = workingTokens.filter(
    (w, i) => w.x !== tokens[i].x || w.y !== tokens[i].y,
  )
  return {
    map,
    moves,
    ...(effect.save ? { save: { label: effect.save, keys: affected.map((t) => t.key) } } : {}),
    notes,
  }
}

const CARDINAL_DIRS = new Set<Direction>(['N', 'E', 'S', 'W'])

/**
 * Slide tokens in `(dx, dy)` up to `steps` squares, processing tokens nearest
 * the destination edge first so each final square blocks subsequent tokens.
 */
function slideTokens(
  map: BattleMap,
  tokens: TokenPos[],
  dx: number,
  dy: number,
  steps: number,
  ctx: ShiftContext,
): { moves: TokenMove[]; notes: string[] } {
  const workingTokens = tokens.map((t) => ({ ...t }))
  const sorted = tokens
    .filter((t) => !ctx.only || ctx.only.has(t.key))
    .sort((a, b) => b.x * dx + b.y * dy - (a.x * dx + a.y * dy))
  const notes: string[] = []

  for (const t of sorted) {
    const blocked = blockedSquares(map, ctx.phase, workingTokens, t.key)
    const res = slideToken(t, dx, dy, steps, map.squares, blocked)
    const slot = workingTokens.find((w) => w.key === t.key)!
    slot.x = res.x
    slot.y = res.y
    if (res.stoppedBy) notes.push(`${t.key} stopped early`)
  }

  const moves: TokenMove[] = workingTokens.filter(
    (w, i) => w.x !== tokens[i].x || w.y !== tokens[i].y,
  )
  return { moves, notes }
}

function planTilt(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'tilt' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const dirEntry =
    (ctx.direction ? DIRECTIONS.find((d) => d.dir === ctx.direction) : undefined) ??
    DIRECTIONS[Math.floor(ctx.random() * 8)]
  const { dir: direction, dx, dy } = dirEntry

  const nextPieces = map.pieces.map((p) => {
    if (p.kind !== 'object' || !effect.carry.includes(p.id) || !inPhase(p, ctx.phase)) return p
    const res = slideToken(p, dx, dy, effect.squares, map.squares, new Set())
    return res.x === p.x && res.y === p.y ? p : { ...p, x: res.x, y: res.y }
  })
  const nextMap: BattleMap = { ...map, pieces: nextPieces }
  const { moves, notes } = slideTokens(nextMap, tokens, dx, dy, effect.squares, ctx)

  return {
    map: nextMap,
    moves,
    ...(effect.save ? { save: { label: effect.save, keys: tokens.map((t) => t.key) } } : {}),
    direction,
    notes,
  }
}

function planGravity(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'gravity' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const bosses = map.pieces.filter((p) => p.kind === 'boss' && inPhase(p, ctx.phase))
  if (bosses.length === 0) {
    return { map, moves: [], notes: ['No Chorus member on the map'] }
  }

  const anchors = bosses.map((p) => ({ key: p.key, label: p.name ?? p.key }))
  const anchorPiece = (ctx.anchor ? bosses.find((p) => p.key === ctx.anchor) : undefined) ?? bosses[0]
  const { w, h } = dims(anchorPiece)
  const n = map.squares
  // Tie-break order: north, east, south, west.
  const wallDistances: { dir: Direction; dist: number }[] = [
    { dir: 'N', dist: anchorPiece.y },
    { dir: 'E', dist: n - (anchorPiece.x + w) },
    { dir: 'S', dist: n - (anchorPiece.y + h) },
    { dir: 'W', dist: anchorPiece.x },
  ]
  const nearest = wallDistances.reduce((best, cur) => (cur.dist < best.dist ? cur : best))
  const direction =
    ctx.direction && CARDINAL_DIRS.has(ctx.direction) ? ctx.direction : nearest.dir
  const { dx, dy } = DIRECTIONS.find((d) => d.dir === direction)!
  const { moves, notes } = slideTokens(map, tokens, dx, dy, effect.squares, ctx)

  return {
    map,
    moves,
    direction,
    anchor: anchorPiece.key,
    anchors,
    notes,
  }
}

/** Rotate a box 90 degrees clockwise about the centre of an `n x n` grid. */
export function rotateBoxClockwise(
  box: { x: number; y: number; w: number; h: number },
  n: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: n - box.y - box.h,
    y: box.x,
    w: box.h,
    h: box.w,
  }
}

function squareInBand(x: number, y: number, n: number, within: number): boolean {
  return x < within || y < within || x >= n - within || y >= n - within
}

function bandCoverage(
  x: number,
  y: number,
  w: number,
  h: number,
  n: number,
  within: number,
): 'all' | 'partial' | 'none' {
  let allIn = true
  let anyIn = false
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (squareInBand(x + dx, y + dy, n, within)) {
        anyIn = true
      } else {
        allIn = false
      }
    }
  }
  if (allIn && anyIn) return 'all'
  return anyIn ? 'partial' : 'none'
}

function planRotate(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'rotate' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const n = map.squares
  const notes: string[] = []
  const bossBefore = effect.afterimage
    ? map.pieces.find((p) => p.kind === 'boss' && inPhase(p, ctx.phase))
    : undefined

  const nextPieces = map.pieces.map((p) => {
    if (p.kind === 'exit' || !inPhase(p, ctx.phase)) return p
    const { w, h } = dims(p)
    const cov = bandCoverage(p.x, p.y, w, h, n, effect.within)
    if (cov === 'none') return p
    if (cov === 'partial') {
      notes.push(`${p.name ?? p.key} straddles the edge band and was not moved`)
      return p
    }
    const rot = rotateBoxClockwise({ x: p.x, y: p.y, w, h }, n)
    const hasDims = p.w !== undefined || p.h !== undefined
    return {
      ...p,
      x: rot.x,
      y: rot.y,
      ...(hasDims ? { w: rot.w, h: rot.h } : {}),
    }
  })

  if (effect.afterimage && bossBefore) {
    const item = PALETTE.find((entry) => entry.art === effect.afterimage)
    if (!item) throw new Error(`Unknown palette object: ${effect.afterimage}`)
    const used = nextPieces
      .filter((p) => p.key.startsWith('afterimage:'))
      .map((p) => Number(p.key.slice('afterimage:'.length)))
      .filter((num) => Number.isFinite(num))
    const nextNum = used.length ? Math.max(...used) + 1 : 1
    nextPieces.push({
      key: `afterimage:${nextNum}`,
      kind: 'object',
      id: item.art,
      x: bossBefore.x,
      y: bossBefore.y,
      size: 1,
      w: item.w,
      h: item.h,
      name: item.name,
    })
  }

  const moves: TokenMove[] = []
  for (const t of tokens) {
    if (!squareInBand(t.x, t.y, n, effect.within)) continue
    const rot = rotateBoxClockwise({ x: t.x, y: t.y, w: 1, h: 1 }, n)
    if (rot.x !== t.x || rot.y !== t.y) {
      moves.push({ key: t.key, x: rot.x, y: rot.y })
    }
  }

  return {
    map: { ...map, pieces: nextPieces },
    moves,
    notes,
  }
}

function areaFits(
  x: number,
  y: number,
  w: number,
  h: number,
  occupied: Set<string>,
): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (occupied.has(`${x + dx},${y + dy}`)) return false
    }
  }
  return true
}

function markArea(x: number, y: number, w: number, h: number, occupied: Set<string>): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      occupied.add(`${x + dx},${y + dy}`)
    }
  }
}

function planSections(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'sections' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const keptAreas = (map.areas ?? []).filter((a) => !a.key.startsWith('section:'))
  const occupied = blockedSquares(map, ctx.phase, [])
  for (const d of doorSquares(map)) {
    occupied.add(`${d.x},${d.y}`)
  }

  const placed: { area: MapArea; note: string }[] = []
  const notes: string[] = []
  if (effect.outcomes.length > 0) {
    for (let i = 0; i < effect.count; i++) {
      const candidates: { x: number; y: number }[] = []
      for (let y = 0; y <= map.squares - effect.h; y++) {
        for (let x = 0; x <= map.squares - effect.w; x++) {
          if (areaFits(x, y, effect.w, effect.h, occupied)) {
            candidates.push({ x, y })
          }
        }
      }
      if (candidates.length === 0) {
        notes.push(`Only ${placed.length} of ${effect.count} sections fit on the map`)
        break
      }
      const spot = candidates[Math.floor(ctx.random() * candidates.length)]
      const outcome = effect.outcomes[Math.floor(ctx.random() * effect.outcomes.length)]
      markArea(spot.x, spot.y, effect.w, effect.h, occupied)
      placed.push({
        area: {
          key: `section:${i}`,
          kind: outcome.kind,
          name: outcome.name,
          x: spot.x,
          y: spot.y,
          w: effect.w,
          h: effect.h,
        },
        note: outcome.note,
      })
    }
  }

  for (const t of tokens) {
    const hit = placed.find(
      ({ area }) =>
        t.x >= area.x && t.x < area.x + area.w && t.y >= area.y && t.y < area.y + area.h,
    )
    if (hit) notes.push(`${t.key} ${hit.note}`)
  }

  return {
    map: { ...map, areas: [...keptAreas, ...placed.map((p) => p.area)] },
    moves: [],
    notes,
  }
}

function planTracks(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'tracks' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const workingPieces = map.pieces.map((p) => ({ ...p }))
  const tracks = (map.areas ?? []).filter(
    (a) => a.kind === effect.track && inPhase(a, ctx.phase),
  )
  const tokenSquares = new Set(tokens.map((t) => `${t.x},${t.y}`))
  const hitSquares = new Set<string>()

  for (const piece of workingPieces) {
    if (piece.kind !== 'object' || piece.id !== effect.art || !inPhase(piece, ctx.phase)) continue
    const track = tracks.find(
      (a) =>
        piece.x >= a.x && piece.x < a.x + a.w && piece.y >= a.y && piece.y < a.y + a.h,
    )
    if (!track) continue

    const targetY =
      piece.y - track.y < track.h / 2 ? track.y + track.h - 1 : track.y
    const dy = Math.sign(targetY - piece.y)
    if (dy === 0) continue

    const blocked = blockedSquares(
      { ...map, pieces: workingPieces },
      ctx.phase,
      [],
      piece.key,
    )
    let maxEndY = piece.y
    for (let y = piece.y + dy; y !== targetY + dy; y += dy) {
      if (y < 0 || y >= map.squares || blocked.has(`${piece.x},${y}`)) break
      maxEndY = y
    }

    for (let y = piece.y + dy; y !== maxEndY + dy; y += dy) {
      hitSquares.add(`${piece.x},${y}`)
    }

    let endY = maxEndY
    while (endY !== piece.y && tokenSquares.has(`${piece.x},${endY}`)) {
      endY -= dy
    }
    piece.y = endY
  }

  const notes: string[] = []
  for (const t of tokens) {
    if (hitSquares.has(`${t.x},${t.y}`)) {
      notes.push(`${t.key} ${effect.note}`)
    }
  }

  return {
    map: { ...map, pieces: workingPieces },
    moves: [],
    notes,
  }
}

function orbitCandidates(
  x: number,
  y: number,
  w: number,
  h: number,
  n: number,
  squares: number,
): { x: number; y: number }[] {
  const c = (n - 1) / 2
  const dx = x - c
  const dy = y - c
  const r = Math.hypot(dx, dy)
  if (r === 0) return [{ x, y }]
  const angle = Math.atan2(dy, dx) + squares / r
  const rawX = c + r * Math.cos(angle)
  const rawY = c + r * Math.sin(angle)
  const clampX = (v: number) => Math.min(n - w, Math.max(0, v))
  const clampY = (v: number) => Math.min(n - h, Math.max(0, v))

  const rounded = { x: clampX(Math.round(rawX)), y: clampY(Math.round(rawY)) }
  const xs = [Math.floor(rawX), Math.ceil(rawX)].map(clampX)
  const ys = [Math.floor(rawY), Math.ceil(rawY)].map(clampY)
  const combos: { x: number; y: number; dist: number }[] = []
  for (const cx of xs) {
    for (const cy of ys) {
      if (cx === rounded.x && cy === rounded.y) continue
      combos.push({ x: cx, y: cy, dist: (cx - rawX) ** 2 + (cy - rawY) ** 2 })
    }
  }
  combos.sort((a, b) => a.dist - b.dist)

  const seen = new Set<string>([`${rounded.x},${rounded.y}`])
  const out = [rounded]
  for (const cand of combos) {
    const k = `${cand.x},${cand.y}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ x: cand.x, y: cand.y })
  }
  return out
}

function addSweepZone(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  zone: Set<string>,
): void {
  const dx = x1 - x0
  const dy = y1 - y0
  const steps = Math.max(Math.abs(dx), Math.abs(dy))
  if (steps === 0) return
  for (let i = 0; i <= steps; i++) {
    const sx = Math.round(x0 + (dx * i) / steps)
    const sy = Math.round(y0 + (dy * i) / steps)
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        zone.add(`${sx + ox},${sy + oy}`)
      }
    }
  }
}

function planOrbit(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'orbit' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const workingPieces = map.pieces.map((p) => ({ ...p }))
  const sweepZone = new Set<string>()
  const notes: string[] = []

  for (const piece of workingPieces) {
    if (piece.kind !== 'object' || piece.id !== effect.art || !inPhase(piece, ctx.phase)) continue
    const { w, h } = dims(piece)
    const blocked = blockedSquares(
      { ...map, pieces: workingPieces },
      ctx.phase,
      tokens,
      piece.key,
    )
    const dest = orbitCandidates(piece.x, piece.y, w, h, map.squares, effect.squares).find(
      (cand) => areaFits(cand.x, cand.y, w, h, blocked),
    )
    if (!dest) {
      notes.push(`${piece.name ?? piece.key} was blocked and did not move`)
      continue
    }
    addSweepZone(piece.x, piece.y, dest.x, dest.y, sweepZone)
    piece.x = dest.x
    piece.y = dest.y
  }

  for (const t of tokens) {
    if (sweepZone.has(`${t.x},${t.y}`)) {
      notes.push(`${t.key} ${effect.note}`)
    }
  }

  if (
    effect.dragged &&
    workingPieces.some(
      (p) => p.kind === 'object' && p.id === effect.dragged && inPhase(p, ctx.phase),
    )
  ) {
    notes.push('Re-place the transit cables on the moved columns')
  }

  return {
    map: { ...map, pieces: workingPieces },
    moves: [],
    notes,
  }
}

function nearestIslandSquare(
  from: { x: number; y: number },
  squares: number,
  chasmSquares: Set<string>,
  blocked: Set<string>,
): { x: number; y: number } | null {
  let best: { x: number; y: number; cheb: number; euclid: number } | null = null
  for (let y = 0; y < squares; y++) {
    for (let x = 0; x < squares; x++) {
      const sq = `${x},${y}`
      if (chasmSquares.has(sq) || blocked.has(sq)) continue
      const dx = Math.abs(x - from.x)
      const dy = Math.abs(y - from.y)
      const cheb = Math.max(dx, dy)
      const euclid = dx * dx + dy * dy
      if (
        !best ||
        cheb < best.cheb ||
        (cheb === best.cheb &&
          (euclid < best.euclid ||
            (euclid === best.euclid && (y < best.y || (y === best.y && x < best.x)))))
      ) {
        best = { x, y, cheb, euclid }
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null
}

function planChasms(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'chasms' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  const existingAreas = map.areas ?? []
  const existingKeys = new Set(existingAreas.map((a) => a.key))
  const addedAreas: MapArea[] = []
  effect.areas.forEach((rect, i) => {
    const key = `chasm:${i}`
    if (!existingKeys.has(key)) {
      addedAreas.push({
        key,
        kind: 'chasm',
        name: effect.name,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      })
    }
  })

  const nextMap: BattleMap = { ...map, areas: [...existingAreas, ...addedAreas] }
  const chasmSquares = new Set<string>()
  for (const a of nextMap.areas ?? []) {
    if (a.kind === 'chasm' && inPhase(a, ctx.phase)) {
      markArea(a.x, a.y, a.w, a.h, chasmSquares)
    }
  }

  const workingTokens = tokens.map((t) => ({ ...t }))
  const notes: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (!chasmSquares.has(`${t.x},${t.y}`)) continue
    const blocked = blockedSquares(nextMap, ctx.phase, workingTokens, t.key)
    const dest = nearestIslandSquare(t, nextMap.squares, chasmSquares, blocked)
    if (dest) {
      workingTokens[i].x = dest.x
      workingTokens[i].y = dest.y
      notes.push(`${t.key} ${effect.note}`)
    }
  }

  const moves: TokenMove[] = workingTokens.filter(
    (w, i) => w.x !== tokens[i].x || w.y !== tokens[i].y,
  )

  return {
    map: nextMap,
    moves,
    notes,
  }
}

type HalfSide = 'west' | 'north' | 'east' | 'south'

const HALF_ORDER: readonly HalfSide[] = ['west', 'north', 'east', 'south']

function halfSideOf(area: MapArea): HalfSide {
  if (area.x > 0) return 'east'
  if (area.y > 0) return 'south'
  return area.w < area.h ? 'west' : 'north'
}

function halfBox(side: HalfSide, n: number): { x: number; y: number; w: number; h: number } {
  const half = Math.floor(n / 2)
  switch (side) {
    case 'west':
      return { x: 0, y: 0, w: half, h: n }
    case 'north':
      return { x: 0, y: 0, w: n, h: half }
    case 'east':
      return { x: half, y: 0, w: n - half, h: n }
    case 'south':
      return { x: 0, y: half, w: n, h: n - half }
  }
}

function planHalves(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'halves' }>,
): ShiftPlan {
  const areas = map.areas ?? []
  const current = areas.find((a) => a.key === 'half:0')
  const firstIdx = current ? (HALF_ORDER.indexOf(halfSideOf(current)) + 1) % 4 : 0
  const secondIdx = (firstIdx + 2) % 4
  const firstBox = halfBox(HALF_ORDER[firstIdx], map.squares)
  const secondBox = halfBox(HALF_ORDER[secondIdx], map.squares)
  const keptAreas = areas.filter((a) => !a.key.startsWith('half:'))

  return {
    map: {
      ...map,
      areas: [
        ...keptAreas,
        { key: 'half:0', kind: effect.first.kind, name: effect.first.name, ...firstBox },
        { key: 'half:1', kind: effect.second.kind, name: effect.second.name, ...secondBox },
      ],
    },
    moves: [],
    notes: [],
  }
}

function umbraBox(
  map: BattleMap,
  within: number,
  phase: number,
): { x: number; y: number; w: number; h: number } {
  const n = map.squares
  const boss = map.pieces.find((p) => p.kind === 'boss' && inPhase(p, phase))
  if (!boss) return { x: 0, y: 0, w: n, h: n }
  const { w, h } = dims(boss)
  const x = Math.max(0, boss.x - within)
  const y = Math.max(0, boss.y - within)
  const x1 = Math.min(n, boss.x + w + within)
  const y1 = Math.min(n, boss.y + h + within)
  return { x, y, w: x1 - x, h: y1 - y }
}

function planEclipse(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'eclipse' }>,
  ctx: ShiftContext,
): ShiftPlan {
  const areas = map.areas ?? []
  const current = areas.find((a) => a.key === 'eclipse:0')
  const showUmbra = current?.kind === effect.zenith.kind
  const box = showUmbra
    ? umbraBox(map, effect.umbra.within, ctx.phase)
    : { x: 0, y: 0, w: map.squares, h: map.squares }
  const spec = showUmbra ? effect.umbra : effect.zenith
  const keptAreas = areas.filter((a) => !a.key.startsWith('eclipse:'))

  return {
    map: {
      ...map,
      areas: [
        ...keptAreas,
        { key: 'eclipse:0', kind: spec.kind, name: spec.name, ...box },
      ],
    },
    moves: [],
    notes: [],
  }
}

function planHighlight(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'highlight' }>,
  ctx: ShiftContext,
): ShiftPlan {
  const areas = map.areas ?? []
  if (areas.some((a) => a.key.startsWith('highlight:'))) {
    return {
      map: { ...map, areas: areas.filter((a) => !a.key.startsWith('highlight:')) },
      moves: [],
      notes: [],
    }
  }

  const added: MapArea[] = map.pieces
    .filter((p) => p.kind === 'object' && p.id === effect.art && inPhase(p, ctx.phase))
    .map((p, i) => {
      const { w, h } = dims(p)
      return {
        key: `highlight:${i}`,
        kind: effect.area.kind,
        name: effect.area.name,
        x: p.x,
        y: p.y,
        w,
        h,
      }
    })

  return {
    map: { ...map, areas: [...areas, ...added] },
    moves: [],
    notes: [],
  }
}

function nearestTouchingSquare(
  target: { x: number; y: number },
  boss: { x: number; y: number; w: number; h: number },
  squares: number,
  blocked: Set<string>,
): { x: number; y: number } | null {
  const minX = Math.max(0, boss.x - 1)
  const maxX = Math.min(squares - 1, boss.x + boss.w)
  const minY = Math.max(0, boss.y - 1)
  const maxY = Math.min(squares - 1, boss.y + boss.h)
  let best: { x: number; y: number; cheb: number; euclid: number } | null = null

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x >= boss.x && x < boss.x + boss.w && y >= boss.y && y < boss.y + boss.h) continue
      if (blocked.has(`${x},${y}`)) continue
      const dx = Math.abs(x - target.x)
      const dy = Math.abs(y - target.y)
      const cheb = Math.max(dx, dy)
      const euclid = dx * dx + dy * dy
      if (
        !best ||
        cheb < best.cheb ||
        (cheb === best.cheb &&
          (euclid < best.euclid ||
            (euclid === best.euclid && (y < best.y || (y === best.y && x < best.x)))))
      ) {
        best = { x, y, cheb, euclid }
      }
    }
  }
  return best ? { x: best.x, y: best.y } : null
}

function planPlace(
  map: BattleMap,
  effect: Extract<ShiftEffect, { kind: 'place' }>,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  if (map.pieces.some((p) => p.key.startsWith('place:'))) {
    return { map, moves: [], notes: ['The shards are already on the map'] }
  }
  const boss = map.pieces.find((p) => p.kind === 'boss' && inPhase(p, ctx.phase))
  if (!boss) {
    return { map, moves: [], notes: ['No boss on the map'] }
  }

  const item = PALETTE.find((entry) => entry.art === effect.art)
  if (!item) throw new Error(`Unknown palette object: ${effect.art}`)

  const bossDims = dims(boss)
  const workingPieces = [...map.pieces]
  const blocked = blockedSquares(map, ctx.phase, tokens)

  effect.spots.forEach((spot, i) => {
    const tx = boss.x + spot.dx
    const ty = boss.y + spot.dy
    const targetOk =
      tx >= 0 &&
      ty >= 0 &&
      tx < map.squares &&
      ty < map.squares &&
      !blocked.has(`${tx},${ty}`)
    const dest = targetOk
      ? { x: tx, y: ty }
      : nearestTouchingSquare(
          { x: tx, y: ty },
          { x: boss.x, y: boss.y, w: bossDims.w, h: bossDims.h },
          map.squares,
          blocked,
        )
    if (!dest) return
    markArea(dest.x, dest.y, item.w, item.h, blocked)
    workingPieces.push({
      key: `place:${i}`,
      kind: 'object',
      id: effect.art,
      x: dest.x,
      y: dest.y,
      size: 1,
      w: item.w,
      h: item.h,
      name: effect.name,
    })
  })

  return {
    map: { ...map, pieces: workingPieces },
    moves: [],
    notes: [effect.note],
  }
}

/** Plan the map update and any token moves for a boss arena's shift effect. */
export function planShift(
  map: BattleMap,
  effect: ShiftEffect,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  switch (effect.kind) {
    case 'chasms':
      return planChasms(map, effect, tokens, ctx)
    case 'conveyor':
      return planConveyor(map, effect, tokens, ctx)
    case 'eclipse':
      return planEclipse(map, effect, ctx)
    case 'gravity':
      return planGravity(map, effect, tokens, ctx)
    case 'halves':
      return planHalves(map, effect)
    case 'highlight':
      return planHighlight(map, effect, ctx)
    case 'march':
      return planMarch(map, effect, tokens, ctx)
    case 'mirror':
      return planMirror(map, tokens)
    case 'orbit':
      return planOrbit(map, effect, tokens, ctx)
    case 'place':
      return planPlace(map, effect, tokens, ctx)
    case 'push':
      return planPush(map, effect, tokens, ctx)
    case 'rotate':
      return planRotate(map, effect, tokens, ctx)
    case 'sections':
      return planSections(map, effect, tokens, ctx)
    case 'tilt':
      return planTilt(map, effect, tokens, ctx)
    case 'tracks':
      return planTracks(map, effect, tokens, ctx)
  }
}
