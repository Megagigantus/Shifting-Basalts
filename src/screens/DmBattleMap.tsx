// DM screen: the room's battle map, for combat, elite and boss rooms.
// Everything is shown, hidden things dashed and faded, and the DM can move
// any piece (players' tokens included), drop objects from the palette,
// remove objects, and swap Kaelen and Vyr's form. Boss arenas switch to their
// phase 2 art and pieces when the boss is Bloodied.
import { useState } from 'react'
import type { RunState } from '../model/run'
import type { Room } from '../rules/rooms'
import { bossBloodied, hpTrackers } from '../rules/hp'
import { ringOf } from '../rules/closingRing'
import { arenaOf, currentForm, inPhase, mapPhase, PALETTE, type MapPiece } from '../rules/battleMap'
import { dropMapObject, layOutMap, moveMapPiece, removeMapObject, swapBossForm } from '../rules/roomFlow'
import { moveToken, roomKeyOf, useTokens } from '../runStore'
import { artUrl } from '../art'
import { BattleBoard } from './BattleBoard'
import { playerPieces, roomPieces, spotAfterMove, tokenOwner, useLooks } from './mapPieces'
import { useShiftMap } from './useShiftMap'
import { Grid3x3 } from 'lucide-react'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { FIELD, PRIMARY_BUTTON, SMALL_BUTTON } from '../ui/styles'

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
  const looks = useLooks()
  const shift = useShiftMap(state, room, act)
  const [toDrop, setToDrop] = useState(PALETTE[0]?.art ?? '')
  const map = room.map ?? null

  if (room.kind !== 'combat' && room.kind !== 'elite' && room.kind !== 'boss') return null
  if (!map) {
    return (
      <Panel title="Battle map" icon={<Grid3x3 size={15} />}>
        <p className="m-0 text-xs text-stone-400">This room was made before battle maps existed.</p>
        <button type="button" disabled={busy} className={`${PRIMARY_BUTTON} self-start`} onClick={() => act((s) => layOutMap(s, Math.random))}>
          Lay out the battle map
        </button>
      </Panel>
    )
  }

  const ctx = { partyLevel: state.run.partyLevel, pressures: state.run.pressures }
  const allTrackers = hpTrackers(room, ctx)
  const trackers = new Map(allTrackers.map((t) => [t.key, t]))
  // A boss with separate part pools has no "boss" tracker; its whole-boss
  // token shows the parts added together.
  if (!trackers.has('boss') && allTrackers.some((t) => t.part !== undefined)) {
    const max = allTrackers.reduce((s, t) => s + t.max, 0)
    const current = allTrackers.reduce((s, t) => s + t.current, 0)
    trackers.set('boss', { key: 'boss', label: 'Whole boss', max, current, bloodied: current <= max / 2, down: current === 0 })
  }
  const bloodied = bossBloodied(room, ctx)
  const phase = mapPhase(map, bloodied)
  const roomKey = roomKeyOf(room)
  const arena = map.arena ? arenaOf(map.arena) : undefined
  const form = currentForm(map)
  const ring = ringOf(room, state.run.pressures)
  const mapArt = map.arena ? (phase === 2 ? artUrl('arenas', `${map.arena}-phase-2`) : null) ?? artUrl('arenas', map.arena) : artUrl('maps', room.shape)

  function isHidden(p: MapPiece): boolean {
    if (p.kind === 'terrain') return p.id === 'false-wall' && !room.revealed.falseWall
    if (p.kind === 'trick') return !room.tricks.find((t) => t.id === p.id)?.revealed
    if (p.kind === 'enemy') return !room.encounter?.groups[Number(p.key.split(':')[1])]?.revealed
    return false
  }

  /** HP label and Bloodied/Down for enemies and boss tokens. */
  function trackerOf(p: MapPiece) {
    return p.kind === 'enemy' ? trackers.get(p.key) : p.kind === 'boss' && p.hp ? trackers.get(p.hp) : undefined
  }

  const pieces = [
    ...roomPieces(map.pieces, {
      trueExit: room.trueExit,
      groupCounts: room.encounter?.groups.map((g) => g.count) ?? [],
      movable: true,
      removable: true,
      phase,
      hidden: isHidden,
      label: (p) => {
        const t = trackerOf(p)
        if (!t) return undefined
        const who = p.kind === 'boss' ? (p.name ?? t.label) : t.label
        return `${who}: ${t.current}/${t.max} HP`
      },
    }).map((bp) => {
      const src = map.pieces.find((q) => q.key === bp.key)!
      const t = trackerOf(src)
      const state = t?.down
        ? ('down' as const)
        : src.kind === 'boss' && src.hp === 'boss'
          ? bloodied
            ? ('bloodied' as const)
            : null
          : t?.bloodied
            ? ('bloodied' as const)
            : null
      return { ...bp, state }
    }),
    ...playerPieces(state.players, looks, map, tokens, roomKey, () => true, () => false),
  ]

  function onMove(key: string, x: number, y: number) {
    const owner = tokenOwner(key)
    if (owner) {
      moveToken(state.run.id, owner, spotAfterMove(pieces, key, x, y), roomKey).catch((e) => console.error('Could not move the token', e))
    } else {
      act((s) => moveMapPiece(s, key, x, y))
    }
  }

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
          {map.arena && phase === 2 && <Pill tone="rose">Phase 2</Pill>}
          {ring && ring.width > 0 && <Pill tone="rose">Ring {ring.width * 5} ft</Pill>}
        </>
      }
      actions={
        <>
          {form && (
            <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => act((s) => swapBossForm(s))}>
              Swap form (now {form === 'vyr' ? 'Vyr' : 'Kaelen'})
            </button>
          )}
          {shift && (
            <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={shift.trigger}>
              {shift.label}
            </button>
          )}
          <ConfirmButton
            tone="amber"
            disabled={busy}
            confirmLabel={map.arena ? 'Yes, reset the arena' : 'Yes, place everything again'}
            onConfirm={() => act((s) => layOutMap(s, Math.random))}
          >
            {map.arena ? 'Reset arena' : 'Lay out again'}
          </ConfirmButton>
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
        busy={busy}
        ringWidth={ring?.width ?? 0}
        onMove={onMove}
        onRemove={(key) => act((s) => removeMapObject(s, key))}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-stone-300">
          Drop an object
          <select value={toDrop} onChange={(e) => setToDrop(e.target.value)} disabled={busy} className={FIELD}>
            {PALETTE.map((p) => (
              <option key={p.art} value={p.art}>
                {p.name}
                {p.w > 1 || p.h > 1 ? ` (${p.w} × ${p.h})` : ''}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={SMALL_BUTTON} disabled={busy || !toDrop} onClick={() => act((s) => dropMapObject(s, toDrop))}>
          Drop in the middle
        </button>
      </div>
      <p className="m-0 text-[0.6875rem] text-stone-500">
        Drag any piece, or select it and use the arrow keys. Select an object and press × (or Delete) to remove it. Dashed and faded pieces
        are hidden from players. Gold rings are the players; each player can move only their own. The shaded squares are the entrance.
      </p>
      {arena?.notes && <p className="m-0 text-[0.6875rem] text-stone-400">Arena: {arena.notes}</p>}
      {shift?.picker}
    </Panel>
  )
}
