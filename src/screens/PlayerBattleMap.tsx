// Player screen: the shared battle map, built only from the player view
// (run.roomView.map), so nothing hidden ever reaches it. A player can move
// only their own token; the DM's "view as player" preview moves nothing.
import type { RunPlayer, RunState } from '../model/run'
import { moveToken, roomKeyOf, useTokens } from '../runStore'
import { artUrl } from '../art'
import { BattleBoard } from './BattleBoard'
import { playerPieces, roomPieces } from './mapPieces'

interface Props {
  state: RunState
  me: RunPlayer | null
  readOnly: boolean
}

export function PlayerBattleMap({ state, me, readOnly }: Props) {
  const { run } = state
  const view = run.roomView
  const tokens = useTokens(run.id)
  const map = view?.map ?? null
  if (!view || !map) return null

  const roomKey = roomKeyOf(view)
  const myId = me?.characterId ?? null
  const counts: number[] = []
  for (const p of map.pieces) {
    if (p.kind !== 'enemy') continue
    const group = Number(p.key.split(':')[1])
    counts[group] = (counts[group] ?? 0) + 1
  }

  const pieces = [
    ...roomPieces(map.pieces, { trueExit: view.trueExit, groupCounts: counts, movable: false }),
    ...playerPieces(state.players, map, tokens, roomKey, (id) => !readOnly && id === myId, myId),
  ]

  return (
    <div className="battle-map-panel">
      <BattleBoard
        squares={map.squares}
        entrance={map.entrance}
        mapArt={artUrl('maps', view.shape)}
        pieces={pieces}
        busy={false}
        onMove={(key, x, y) => {
          if (key !== `pc:${myId}` || readOnly) return
          moveToken(run.id, key.slice(3), x, y, roomKey).catch((e) => console.error('Could not move your token', e))
        }}
      />
      <p className="hint">
        {readOnly
          ? 'Preview: tokens can\'t be moved here.'
          : myId
            ? 'Drag your token (gold outline), or select it and use the arrow keys.'
            : 'The party\'s battle map.'}
      </p>
    </div>
  )
}
