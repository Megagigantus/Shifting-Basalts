// DM screen: the room's battle map. The map art with a 5 ft grid, doorways,
// terrain, tricks and enemy tokens. Drag a piece (or select it and use the
// arrow keys) to move it; it snaps to the grid and saves on drop. DM only:
// it shows hidden things (dashed and faded) that players can't see yet.
import { useRef, useState } from 'react'
import type { RunState } from '../model/run'
import type { Room } from '../rules/rooms'
import { terrainOf, trickOf } from '../rules/rooms'
import { creatureOf } from '../rules/encounters'
import { hpTrackers } from '../rules/hp'
import { entranceSquares, footprint, type MapPiece } from '../rules/battleMap'
import { layOutMap, moveMapPiece } from '../rules/roomFlow'
import { artUrl, type ArtKind } from '../art'

type Step = (s: RunState) => RunState
type Act = (step: Step, confirmText?: string) => void

interface Props {
  state: RunState
  room: Room
  busy: boolean
  act: Act
}

interface Drag {
  key: string
  /** Pointer offset inside the piece, in squares. */
  dx: number
  dy: number
  x: number
  y: number
}

const ART: Record<MapPiece['kind'], ArtKind> = { exit: 'exits', terrain: 'terrain', trick: 'tricks', enemy: 'creatures' }

export function DmBattleMap({ state, room, busy, act }: Props) {
  const map = room.map ?? null
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** A dropped position, shown only until the saved map (a new `map` object) arrives. */
  const [dropped, setDropped] = useState<{ key: string; x: number; y: number; base: unknown } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const pending = dropped && dropped.base === map ? dropped : null

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

  const n = map.squares
  const trackers = new Map(hpTrackers(room, { partyLevel: state.run.partyLevel, pressures: state.run.pressures }).map((t) => [t.key, t]))
  const pct = (v: number) => `${(v / n) * 100}%`

  /** Pointer position on the board, in squares. */
  function toSquares(e: { clientX: number; clientY: number }) {
    const rect = boardRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * n, y: ((e.clientY - rect.top) / rect.height) * n }
  }

  function drop(key: string, x: number, y: number) {
    setDropped({ key, x: Math.round(x), y: Math.round(y), base: map })
    act((s) => moveMapPiece(s, key, x, y))
  }

  function isHidden(p: MapPiece): boolean {
    if (p.kind === 'terrain') return p.id === 'false-wall' && !room.revealed.falseWall
    if (p.kind === 'trick') return !room.tricks.find((t) => t.id === p.id)?.revealed
    if (p.kind === 'enemy') {
      const group = Number(p.key.split(':')[1])
      return !room.encounter?.groups[group]?.revealed
    }
    return false
  }

  function label(p: MapPiece): string {
    if (p.kind === 'exit') return Number(p.id) === room.trueExit ? `Doorway ${p.id} (true exit)` : `Doorway ${p.id}`
    if (p.kind === 'terrain') return terrainOf(p.id).name
    if (p.kind === 'trick') return `${trickOf(p.id).name} (trick)`
    const t = trackers.get(p.key)
    return t ? `${t.label}: ${t.current}/${t.max} HP${t.down ? ', down' : t.bloodied ? ', Bloodied' : ''}` : creatureOf(p.id).name
  }

  function artId(p: MapPiece): string {
    if (p.kind === 'exit') return Number(p.id) === room.trueExit ? 'true-exit' : 'exit'
    return p.id
  }

  const mapArt = artUrl('maps', room.shape)
  const door = entranceSquares(n, map.entrance)

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
      <div
        ref={boardRef}
        className="battle-map"
        onPointerMove={(e) => {
          if (!drag) return
          const at = toSquares(e)
          setDrag({ ...drag, x: at.x - drag.dx, y: at.y - drag.dy })
        }}
        onPointerUp={() => {
          if (!drag) return
          drop(drag.key, drag.x, drag.y)
          setDrag(null)
        }}
        onPointerCancel={() => setDrag(null)}
      >
        {mapArt && <img className="battle-map-art" src={mapArt} alt="" draggable={false} />}
        <svg className="battle-map-grid" viewBox={`0 0 ${n} ${n}`} preserveAspectRatio="none" aria-hidden="true">
          {door.map((q) => (
            <rect key={`${q.x},${q.y}`} x={q.x} y={q.y} width={1} height={1} className="entrance-square" />
          ))}
          {Array.from({ length: n - 1 }, (_, i) => (
            <g key={i}>
              <line x1={i + 1} y1={0} x2={i + 1} y2={n} />
              <line x1={0} y1={i + 1} x2={n} y2={i + 1} />
            </g>
          ))}
        </svg>
        {map.pieces.map((p) => {
          const s = footprint(p)
          const live = drag?.key === p.key ? drag : pending?.key === p.key ? pending : p
          const t = trackers.get(p.key)
          const hidden = isHidden(p)
          const url = artUrl(ART[p.kind], artId(p))
          const group = p.kind === 'enemy' ? Number(p.key.split(':')[1]) : null
          const count = group !== null ? (room.encounter?.groups[group]?.count ?? 1) : 1
          const classes = [
            'map-piece',
            `map-${p.kind}`,
            hidden ? 'is-hidden' : '',
            t?.down ? 'is-down' : t?.bloodied ? 'is-bloodied' : '',
            selected === p.key ? 'is-selected' : '',
            drag?.key === p.key ? 'is-dragging' : '',
            p.size < 1 ? 'is-tiny' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={p.key}
              type="button"
              className={classes}
              style={{ left: pct(live.x), top: pct(live.y), width: pct(s), height: pct(s) }}
              title={label(p)}
              aria-label={`${label(p)}${hidden ? ' (hidden from players)' : ''}, square ${p.x + 1}, ${p.y + 1}`}
              disabled={busy}
              onFocus={() => setSelected(p.key)}
              onPointerDown={(e) => {
                if (busy) return
                e.preventDefault()
                ;(e.currentTarget.parentElement as HTMLElement).setPointerCapture?.(e.pointerId)
                const at = toSquares(e)
                setSelected(p.key)
                setDrag({ key: p.key, dx: at.x - p.x, dy: at.y - p.y, x: p.x, y: p.y })
              }}
              onKeyDown={(e) => {
                const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
                if (!step || busy) return
                e.preventDefault()
                drop(p.key, p.x + step[0], p.y + step[1])
              }}
            >
              {url ? <img src={url} alt="" draggable={false} /> : <span className="map-fallback">{label(p).slice(0, 2)}</span>}
              {p.kind === 'exit' && <span className="map-badge">{p.id}</span>}
              {p.kind === 'enemy' && count > 1 && <span className="map-badge">{Number(p.key.split(':')[2]) + 1}</span>}
            </button>
          )
        })}
      </div>
      <p className="hint">
        Drag a piece, or select it and use the arrow keys. Dashed and faded pieces are hidden from players. The shaded squares are the
        entrance ({map.entrance}). {n} × {n} squares ({n * 5} ft).
      </p>
    </div>
  )
}
