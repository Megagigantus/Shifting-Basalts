// Player screen: the shared battle map, built only from the player view
// (run.roomView.map), so nothing hidden ever reaches it. A player can move
// only their own characters' tokens (and summons); the DM's "view as player"
// preview moves nothing.
import type { RunState } from '../model/run'
import { moveToken, roomKeyOf, useTokens } from '../runStore'
import { artUrl } from '../art'
import { BattleBoard } from './BattleBoard'
import { playerPieces, roomPieces, spotAfterMove, tokenOwner, useLooks } from './mapPieces'

interface Props {
  state: RunState
  /** The characters this viewer owns in the run. */
  myIds: string[]
  readOnly: boolean
}

export function PlayerBattleMap({ state, myIds, readOnly }: Props) {
  const { run } = state
  const view = run.roomView
  const tokens = useTokens(run.id)
  const looks = useLooks()
  const map = view?.map ?? null
  if (!view || !map) return null

  const roomKey = roomKeyOf(view)
  const mine = (id: string) => myIds.includes(id)
  const counts: number[] = []
  for (const p of map.pieces) {
    if (p.kind !== 'enemy') continue
    const group = Number(p.key.split(':')[1])
    counts[group] = (counts[group] ?? 0) + 1
  }

  const pieces = [
    ...roomPieces(map.pieces, { trueExit: view.trueExit, groupCounts: counts, movable: false }),
    ...playerPieces(state.players, looks, map, tokens, roomKey, (id) => !readOnly && mine(id), mine),
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
          const owner = tokenOwner(key)
          if (readOnly || !owner || !mine(owner)) return
          moveToken(run.id, owner, spotAfterMove(pieces, key, x, y), roomKey).catch((e) => console.error('Could not move your token', e))
        }}
      />
      <p className="hint">
        {readOnly
          ? 'Preview: tokens can\'t be moved here.'
          : myIds.length
            ? 'Drag your tokens (gold outline) and summons, or select one and use the arrow keys.'
            : 'The party\'s battle map.'}
      </p>
    </div>
  )
}
