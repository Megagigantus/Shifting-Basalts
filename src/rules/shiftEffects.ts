// Shared shift plan engine for boss arena Shift Actions. Pure rules functions
// compute the new map, any character/summon token moves, whether a save gates
// those moves, and short DM notes.
import {
  dims,
  inPhase,
  marchColumns,
  mirrorMap,
  mirrorSpot,
  type BattleMap,
  type ShiftEffect,
} from './battleMap'

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
  /** Short DM-facing notes, e.g. "Mira is pinned against the south wall". */
  notes: string[]
}

export interface ShiftContext {
  phase: number
  random: () => number
}

/**
 * Squares ("x,y") occupied in this phase by boss tokens, enemy tokens, and
 * object pieces, plus every token in `tokens` except `ignoreKey`. Painted
 * areas, exits, terrain, and tricks never block movement here.
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

function planMarch(map: BattleMap): ShiftPlan {
  return {
    map: marchColumns(map),
    moves: [],
    notes: [],
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

/** Plan the map update and any token moves for a boss arena's shift effect. */
export function planShift(
  map: BattleMap,
  effect: ShiftEffect,
  tokens: TokenPos[],
  _ctx: ShiftContext,
): ShiftPlan {
  switch (effect.kind) {
    case 'march':
      return planMarch(map)
    case 'mirror':
      return planMirror(map, tokens)
  }
}
