// Player screen: the shared battle map, built only from the player view
// (run.roomView.map), so nothing hidden ever reaches it. A player can move
// only their own characters' tokens (and summons); the DM's "view as player"
// preview moves nothing.
import type { RunState } from '../model/run'
import { moveToken, roomKeyOf, useTokens } from '../runStore'
import { artUrl } from '../art'
import { inPhase, mapPhase } from '../rules/battleMap'
import { BattleBoard } from './BattleBoard'
import { playerPieces, roomPieces, spotAfterMove, tokenOwner, useLooks } from './mapPieces'
import { Grid3x3 } from 'lucide-react'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'

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

  const phase = mapPhase(map, Boolean(view.bossBloodied))
  const mapArt = map.arena
    ? ((phase === 2 ? artUrl('arenas', `${map.arena}-phase-2`) : null) ?? artUrl('arenas', map.arena))
    : artUrl('maps', view.shape)

  const pieces = [
    ...roomPieces(map.pieces, { trueExit: view.trueExit, groupCounts: counts, movable: false, phase, bloodied: Boolean(view.bossBloodied) }),
    ...playerPieces(state.players, looks, map, tokens, roomKey, (id) => !readOnly && mine(id), mine),
  ]

  return (
    <Panel
      tone={map.arena ? 'rose' : 'sky'}
      icon={<Grid3x3 size={15} />}
      title={
        <>
          {map.arena ? 'Boss arena' : 'Battle map'}
          <span className="font-normal text-stone-400">
            {map.squares} × {map.squares} ({map.squares * 5} ft)
          </span>
          {view.ring && view.ring.width > 0 && <Pill tone="rose">Ring {view.ring.width * 5} ft</Pill>}
        </>
      }
    >
      <BattleBoard
        squares={map.squares}
        entrance={map.entrance}
        door={map.door}
        areas={(map.areas ?? []).filter((a) => inPhase(a, phase))}
        mapArt={mapArt}
        flipArt={Boolean(map.flipped)}
        pieces={pieces}
        busy={false}
        ringWidth={view.ring?.width ?? 0}
        onMove={(key, x, y) => {
          const owner = tokenOwner(key)
          if (readOnly || !owner || !mine(owner)) return
          moveToken(run.id, owner, spotAfterMove(pieces, key, x, y), roomKey).catch((e) => console.error('Could not move your token', e))
        }}
      />
      <p className="m-0 text-[0.6875rem] text-stone-500">
        {readOnly
          ? 'Preview: tokens can\'t be moved here.'
          : myIds.length
            ? 'Drag your tokens (gold outline) and summons, or select one and use the arrow keys.'
            : 'The party\'s battle map.'}
      </p>
    </Panel>
  )
}
