// Shared shift plan engine for boss arena Shift Actions. Pure rules functions
// compute the new map, any character/summon token moves, whether a save gates
// those moves, and short DM notes.
import {
  dims,
  inPhase,
  isFloorObject,
  marchColumns,
  mirrorMap,
  mirrorSpot,
  type BattleMap,
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
  /** Downhill direction for tilt effects. */
  direction?: Direction
  /** Short DM-facing notes, e.g. "Mira is pinned against the south wall". */
  notes: string[]
}

export interface ShiftContext {
  phase: number
  random: () => number
  direction?: Direction
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

  const workingTokens = tokens.map((t) => ({ ...t }))
  const sorted = tokens.filter((t) => !ctx.only || ctx.only.has(t.key)).sort((a, b) => b.x * dx + b.y * dy - (a.x * dx + a.y * dy))
  const notes: string[] = []

  for (const t of sorted) {
    const blocked = blockedSquares(nextMap, ctx.phase, workingTokens, t.key)
    const res = slideToken(t, dx, dy, effect.squares, nextMap.squares, blocked)
    const slot = workingTokens.find((w) => w.key === t.key)!
    slot.x = res.x
    slot.y = res.y
    if (res.stoppedBy) notes.push(`${t.key} stopped early`)
  }

  const moves: TokenMove[] = workingTokens.filter(
    (w, i) => w.x !== tokens[i].x || w.y !== tokens[i].y,
  )
  return {
    map: nextMap,
    moves,
    ...(effect.save ? { save: { label: effect.save, keys: tokens.map((t) => t.key) } } : {}),
    direction,
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
    case 'march':
      return planMarch(map, effect, tokens, ctx)
    case 'mirror':
      return planMirror(map, tokens)
    case 'push':
      return planPush(map, effect, tokens, ctx)
    case 'tilt':
      return planTilt(map, effect, tokens, ctx)
  }
}
