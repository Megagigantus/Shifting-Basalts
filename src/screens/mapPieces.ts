// Turning map data into board pieces for the DM and player screens.
import type { RunPlayer } from '../model/run'
import type { Character } from '../model/character'
import { useMemo } from 'react'
import { useCharacters } from '../useCharacters'
import { creatureOf } from '../rules/encounters'
import { terrainOf, trickOf } from '../rules/rooms'
import { inPhase, startSquares, type MapPiece } from '../rules/battleMap'
import type { TokenSpot } from '../runStore'
import { artUrl, type ArtKind } from '../art'
import type { BoardPiece } from './BattleBoard'

const ART: Record<'exit' | 'terrain' | 'trick' | 'enemy', ArtKind> = { exit: 'exits', terrain: 'terrain', trick: 'tricks', enemy: 'creatures' }

/**
 * Art for a boss token ("<folder>:<file>"). In phase 2 a boss portrait
 * becomes its phase 2 portrait when one exists.
 */
function bossTokenArt(id: string, phase: number): string | null {
  const [folder, file] = id.split(':') as [ArtKind, string]
  if (phase === 2 && folder === 'bosses') {
    const second = artUrl('bosses', `${file}-phase-2`)
    if (second) return second
  }
  return artUrl(folder, file)
}

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
    /** The boss arena phase on show (1, or 2 from Bloodied). Pieces of the other phase are left out. */
    phase?: number
    hidden?: (p: MapPiece) => boolean
    /** A label to use instead of the name, or undefined to keep the name. */
    label?: (p: MapPiece) => string | undefined
    /** The DM can remove objects. */
    removable?: boolean
  },
): BoardPiece[] {
  const phase = opts.phase ?? 1
  return pieces.filter((p) => inPhase(p, phase)).map((p) => {
    const isTrue = p.kind === 'exit' && Number(p.id) === opts.trueExit
    const name =
      p.kind === 'exit'
        ? `Doorway ${p.id}${isTrue ? ' (true exit)' : ''}`
        : p.kind === 'terrain'
          ? terrainOf(p.id).name
          : p.kind === 'trick'
            ? `${trickOf(p.id).name} (trick)`
            : p.kind === 'enemy'
              ? creatureOf(p.id).name
              : (p.name ?? p.id)
    const art =
      p.kind === 'boss'
        ? bossTokenArt(p.id, phase)
        : p.kind === 'object'
          ? artUrl('objects', p.id)
          : artUrl(ART[p.kind], p.kind === 'exit' ? (isTrue ? 'true-exit' : 'exit') : p.id)
    const [, group, index] = p.key.split(':')
    const count = p.kind === 'enemy' ? (opts.groupCounts[Number(group)] ?? 1) : 1
    const piece: BoardPiece = {
      key: p.key,
      kind: p.kind,
      x: p.x,
      y: p.y,
      size: p.size,
      art,
      label: opts.label?.(p) ?? (p.kind === 'enemy' && count > 1 ? `${name} ${Number(index) + 1}` : name),
      fallback: name.slice(0, 2),
      badge: p.kind === 'exit' ? p.id : p.kind === 'enemy' && count > 1 ? String(Number(index) + 1) : undefined,
      hidden: opts.hidden?.(p) ?? false,
      state: (p as MapPiece & { state?: 'bloodied' | 'down' | null }).state ?? null,
      movable: opts.movable,
      removable: Boolean(opts.removable && p.kind === 'object'),
    }
    if (p.w !== undefined) piece.w = p.w
    if (p.h !== undefined) piece.h = p.h
    return piece
  })
}

/** The bits of a character the map needs: their portrait and summon. */
export type CharacterLook = Pick<Character, 'portrait' | 'summonArt' | 'hasSummon'>

/** Live portraits and summons by character id (every invited user can read characters). */
export function useLooks(): Record<string, CharacterLook | undefined> {
  const { characters } = useCharacters()
  return useMemo(
    () => Object.fromEntries((characters ?? []).map((c) => [c.id, { portrait: c.portrait, summonArt: c.summonArt, hasSummon: c.hasSummon }])),
    [characters],
  )
}

/**
 * Player tokens (key "pc:<id>") and summon tokens (key "sm:<id>", for
 * living characters with a summon): where each stands in this room, or a
 * start square near the entrance when it hasn't moved here yet.
 */
export function playerPieces(
  players: RunPlayer[],
  looks: Record<string, CharacterLook | undefined>,
  map: Parameters<typeof startSquares>[0],
  tokens: Record<string, TokenSpot>,
  roomKey: string,
  canMove: (characterId: string) => boolean,
  isMine: (characterId: string) => boolean,
): BoardPiece[] {
  const summoners = players.filter((pl) => pl.alive && looks[pl.characterId]?.hasSummon)
  const starts = startSquares(map, players.length + summoners.length)
  const out: BoardPiece[] = players.map((pl, i) => {
    const spot = tokens[pl.characterId]
    const here = spot && spot.roomKey === roomKey ? spot : starts[i]
    const look = looks[pl.characterId]
    return {
      key: `pc:${pl.characterId}`,
      kind: 'player',
      x: here.x,
      y: here.y,
      size: 1,
      art: look?.portrait ? artUrl('portraits', look.portrait) : null,
      label: pl.alive ? pl.name : `${pl.name} (fallen)`,
      fallback: initials(pl.name),
      state: pl.alive ? null : 'down',
      mine: isMine(pl.characterId),
      movable: pl.alive && canMove(pl.characterId),
    }
  })
  summoners.forEach((pl, j) => {
    const spot = tokens[pl.characterId]
    const here =
      spot && spot.roomKey === roomKey && spot.sx !== undefined && spot.sy !== undefined
        ? { x: spot.sx, y: spot.sy }
        : starts[players.length + j]
    const look = looks[pl.characterId]
    out.push({
      key: `sm:${pl.characterId}`,
      kind: 'summon',
      x: here.x,
      y: here.y,
      size: 1,
      art: artUrl('summons', look?.summonArt || 'other'),
      label: `${pl.name}'s summon`,
      fallback: 'S',
      mine: isMine(pl.characterId),
      movable: canMove(pl.characterId),
    })
  })
  return out
}

/** Whose token a board key belongs to ("pc:" or "sm:" keys), or null for room pieces. */
export const tokenOwner = (key: string) => (key.startsWith('pc:') || key.startsWith('sm:') ? key.slice(3) : null)

/**
 * The spot to save after moving one of a character's tokens: the moved one
 * at its new square and the other (character or summon) where it stands now.
 */
export function spotAfterMove(pieces: BoardPiece[], key: string, x: number, y: number): Omit<TokenSpot, 'roomKey'> {
  const id = tokenOwner(key)!
  const pc = pieces.find((p) => p.key === `pc:${id}`)
  const sm = pieces.find((p) => p.key === `sm:${id}`)
  const at = (p: BoardPiece | undefined) => (p && p.key === key ? { x, y } : p ? { x: p.x, y: p.y } : null)
  const self = at(pc) ?? { x, y }
  const summon = at(sm)
  return summon ? { x: self.x, y: self.y, sx: summon.x, sy: summon.y } : self
}
