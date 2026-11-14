// Turning map data into board pieces for the DM and player screens.
import type { RunPlayer } from '../model/run'
import { creatureOf } from '../rules/encounters'
import { terrainOf, trickOf } from '../rules/rooms'
import { startSquares, type MapPiece } from '../rules/battleMap'
import type { TokenSpot } from '../runStore'
import { artUrl, type ArtKind } from '../art'
import type { BoardPiece } from './BattleBoard'

const ART: Record<MapPiece['kind'], ArtKind> = { exit: 'exits', terrain: 'terrain', trick: 'tricks', enemy: 'creatures' }

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?'

/**
 * Board pieces for the room's own map pieces. `trueExit` is the doorway the
 * viewer knows leads on (the DM always knows; players only once revealed).
 */
export function roomPieces(
  pieces: MapPiece[],
  opts: {
    trueExit: number | null
    groupCounts: number[]
    movable: boolean
    hidden?: (p: MapPiece) => boolean
    /** A label to use instead of the name, or undefined to keep the name. */
    label?: (p: MapPiece) => string | undefined
  },
): BoardPiece[] {
  return pieces.map((p) => {
    const isTrue = p.kind === 'exit' && Number(p.id) === opts.trueExit
    const artId = p.kind === 'exit' ? (isTrue ? 'true-exit' : 'exit') : p.id
    const name =
      p.kind === 'exit'
        ? `Doorway ${p.id}${isTrue ? ' (true exit)' : ''}`
        : p.kind === 'terrain'
          ? terrainOf(p.id).name
          : p.kind === 'trick'
            ? `${trickOf(p.id).name} (trick)`
            : creatureOf(p.id).name
    const [, group, index] = p.key.split(':')
    const count = p.kind === 'enemy' ? (opts.groupCounts[Number(group)] ?? 1) : 1
    return {
      key: p.key,
      kind: p.kind,
      x: p.x,
      y: p.y,
      size: p.size,
      art: artUrl(ART[p.kind], artId),
      label: opts.label?.(p) ?? (p.kind === 'enemy' && count > 1 ? `${name} ${Number(index) + 1}` : name),
      fallback: name.slice(0, 2),
      badge: p.kind === 'exit' ? p.id : p.kind === 'enemy' && count > 1 ? String(Number(index) + 1) : undefined,
      hidden: opts.hidden?.(p) ?? false,
      state: (p as MapPiece & { state?: 'bloodied' | 'down' | null }).state ?? null,
      movable: opts.movable,
    }
  })
}

/**
 * Player tokens: where each one stands in this room, or its start square
 * near the entrance when it hasn't moved here yet.
 */
export function playerPieces(
  players: RunPlayer[],
  map: Parameters<typeof startSquares>[0],
  tokens: Record<string, TokenSpot>,
  roomKey: string,
  canMove: (characterId: string) => boolean,
  me: string | null,
): BoardPiece[] {
  const starts = startSquares(map, players.length)
  return players.map((pl, i) => {
    const spot = tokens[pl.characterId]
    const here = spot && spot.roomKey === roomKey ? spot : starts[i]
    return {
      key: `pc:${pl.characterId}`,
      kind: 'player',
      x: here.x,
      y: here.y,
      size: 1,
      art: null,
      label: pl.alive ? pl.name : `${pl.name} (fallen)`,
      fallback: initials(pl.name),
      state: pl.alive ? null : 'down',
      mine: pl.characterId === me,
      movable: pl.alive && canMove(pl.characterId),
    }
  })
}
