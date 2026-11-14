// DM screen: the room's battle map. Everything is shown, hidden things
// dashed and faded, and the DM can move any piece, players' tokens included.
import type { RunState } from '../model/run'
import type { Room } from '../rules/rooms'
import { hpTrackers } from '../rules/hp'
import type { MapPiece } from '../rules/battleMap'
import { layOutMap, moveMapPiece } from '../rules/roomFlow'
import { moveToken, roomKeyOf, useTokens } from '../runStore'
import { artUrl } from '../art'
import { BattleBoard } from './BattleBoard'
import { playerPieces, roomPieces } from './mapPieces'

type Step = (s: RunState) => RunState
type Act = (step: Step, confirmText?: string) => void

interface Props {
  state: RunState
  room: Room
  busy: boolean
  act: Act
}

export function DmBattleMap({ state, room, busy, act }: Props) {
  const tokens = useTokens(state.run.id)
  const map = room.map ?? null

  if (room.kind !== 'combat' && room.kind !== 'elite') return null
  if (!map) {
    return (
      <div className="battle-map-panel">
        <p className="hint">This room was made before battle maps existed.</p>
        <button type="button" disabled={busy} onClick={() => act((s) => layOutMap(s, Math.random))}>
          Lay out the battle map
        </button>
      </div>
    )
  }

  const trackers = new Map(hpTrackers(room, { partyLevel: state.run.partyLevel, pressures: state.run.pressures }).map((t) => [t.key, t]))
  const roomKey = roomKeyOf(room)

  function isHidden(p: MapPiece): boolean {
    if (p.kind === 'terrain') return p.id === 'false-wall' && !room.revealed.falseWall
    if (p.kind === 'trick') return !room.tricks.find((t) => t.id === p.id)?.revealed
    if (p.kind === 'enemy') return !room.encounter?.groups[Number(p.key.split(':')[1])]?.revealed
    return false
  }

  const pieces = [
    ...roomPieces(map.pieces, {
      trueExit: room.trueExit,
      groupCounts: room.encounter?.groups.map((g) => g.count) ?? [],
      movable: true,
      hidden: isHidden,
      label: (p) => {
        const t = trackers.get(p.key)
        return t ? `${t.label}: ${t.current}/${t.max} HP` : undefined
      },
    }).map((bp) => {
      const t = trackers.get(bp.key)
      return { ...bp, state: t?.down ? ('down' as const) : t?.bloodied ? ('bloodied' as const) : null }
    }),
    ...playerPieces(state.players, map, tokens, roomKey, () => true, null),
  ]

  function onMove(key: string, x: number, y: number) {
    if (key.startsWith('pc:')) {
      moveToken(state.run.id, key.slice(3), x, y, roomKey).catch((e) => console.error('Could not move the token', e))
    } else {
      act((s) => moveMapPiece(s, key, x, y))
    }
  }

  return (
    <div className="battle-map-panel">
      <div className="panel-header">
        <h4>Battle map</h4>
        <button
          type="button"
          className="quiet"
          disabled={busy}
          onClick={() => act((s) => layOutMap(s, Math.random), 'Place every doorway, feature, trick and enemy again?')}
        >
          Lay out again
        </button>
      </div>
      <BattleBoard
        squares={map.squares}
        entrance={map.entrance}
        mapArt={artUrl('maps', room.shape)}
        pieces={pieces}
        busy={busy}
        onMove={onMove}
      />
      <p className="hint">
        Drag any piece, or select it and use the arrow keys. Dashed and faded pieces are hidden from players. Gold rings are the players;
        each player can move only their own. The shaded squares are the entrance ({map.entrance}). {map.squares} × {map.squares} squares (
        {map.squares * 5} ft).
      </p>
    </div>
  )
}
