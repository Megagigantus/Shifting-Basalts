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

/** Plan the map update and any token moves for a boss arena's shift effect. */
export function planShift(
  map: BattleMap,
  effect: ShiftEffect,
  tokens: TokenPos[],
  ctx: ShiftContext,
): ShiftPlan {
  switch (effect.kind) {
    case 'conveyor':
      return planConveyor(map, effect, tokens, ctx)
    case 'gravity':
      return planGravity(map, effect, tokens, ctx)
    case 'march':
      return planMarch(map, effect, tokens, ctx)
    case 'mirror':
      return planMirror(map, tokens)
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
