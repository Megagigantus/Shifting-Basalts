// The battle map board shared by the DM and player screens: map art, a 5 ft
// grid, the entrance, painted areas (outlined) and pieces. Movable pieces can
// be dragged (or selected and moved with the arrow keys); they snap to the
// grid and `onMove` saves them. Removable pieces (objects, for the DM) show a
// small remove button when selected. Callers decide what's on the board and
// what each viewer may move.
import { useRef, useState } from 'react'
import { dims, doorSquares, type MapArea, type Side } from '../rules/battleMap'

export interface BoardPiece {
  key: string
  kind: 'exit' | 'terrain' | 'trick' | 'enemy' | 'player' | 'summon' | 'boss' | 'object'
  x: number
  y: number
  /** Squares per side; 0.5 for Tiny. */
  size: number
  /** Rectangles: width and height in squares. */
  w?: number
  h?: number
  art: string | null
  label: string
  /** Short text shown when there's no art (e.g. initials). */
  fallback: string
  badge?: string
  /** DM only: hidden from players (drawn dashed and faded). */
  hidden?: boolean
  state?: 'bloodied' | 'down' | null
  /** The viewer's own token. */
  mine?: boolean
  movable: boolean
  /** The DM can remove it (objects). */
  removable?: boolean
}

interface Props {
  squares: number
  entrance: Side
  door?: { x: number; y: number; w: number; h: number }
  areas?: MapArea[]
  mapArt: string | null
  pieces: BoardPiece[]
  busy: boolean
  onMove: (key: string, x: number, y: number) => void
  onRemove?: (key: string) => void
}

interface Drag {
  key: string
  dx: number
  dy: number
  x: number
  y: number
}

export function BattleBoard({ squares: n, entrance, door, areas = [], mapArt, pieces, busy, onMove, onRemove }: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  /** A dropped position, shown until the piece's saved position changes. */
  const [dropped, setDropped] = useState<{ key: string; x: number; y: number; fromX: number; fromY: number } | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const pct = (v: number) => `${(v / n) * 100}%`

  function toSquares(e: { clientX: number; clientY: number }) {
    const rect = boardRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * n, y: ((e.clientY - rect.top) / rect.height) * n }
  }

  function drop(p: BoardPiece, x: number, y: number) {
    const { w, h } = dims(p)
    const cx = Math.min(n - w, Math.max(0, Math.round(x)))
    const cy = Math.min(n - h, Math.max(0, Math.round(y)))
    if (cx === p.x && cy === p.y) return
    setDropped({ key: p.key, x: cx, y: cy, fromX: p.x, fromY: p.y })
    onMove(p.key, cx, cy)
  }

  return (
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
        const p = pieces.find((q) => q.key === drag.key)
        if (p) drop(p, drag.x, drag.y)
        setDrag(null)
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {mapArt && <img className="battle-map-art" src={mapArt} alt="" draggable={false} />}
      <svg className="battle-map-grid" viewBox={`0 0 ${n} ${n}`} preserveAspectRatio="none" aria-hidden="true">
        {doorSquares({ squares: n, entrance, door }).map((q) => (
          <rect key={`${q.x},${q.y}`} x={q.x} y={q.y} width={1} height={1} className="entrance-square" />
        ))}
        {Array.from({ length: n - 1 }, (_, i) => (
          <g key={i}>
            <line x1={i + 1} y1={0} x2={i + 1} y2={n} />
            <line x1={0} y1={i + 1} x2={n} y2={i + 1} />
          </g>
        ))}
      </svg>
      {areas.map((a) => (
        <div
          key={a.key}
          className={`map-area map-area-${a.kind}`}
          style={{ left: pct(a.x), top: pct(a.y), width: pct(a.w), height: pct(a.h) }}
          title={a.name}
        >
          <span>{a.name}</span>
        </div>
      ))}
      {pieces.map((p) => {
        const { w, h } = dims(p)
        const stillMoving = dropped?.key === p.key && dropped.fromX === p.x && dropped.fromY === p.y
        const live = drag?.key === p.key ? drag : stillMoving ? dropped : p
        const classes = [
          'map-piece',
          `map-${p.kind}`,
          w !== h ? 'is-rect' : '',
          p.hidden ? 'is-hidden' : '',
          p.state === 'down' ? 'is-down' : p.state === 'bloodied' ? 'is-bloodied' : '',
          p.mine ? 'is-mine' : '',
          p.movable ? 'is-movable' : '',
          selected === p.key ? 'is-selected' : '',
          drag?.key === p.key ? 'is-dragging' : '',
          p.size < 1 ? 'is-tiny' : '',
        ]
          .filter(Boolean)
          .join(' ')
        const tag = p.state === 'down' ? ', down' : p.state === 'bloodied' ? ', Bloodied' : ''
        return (
          <button
            key={p.key}
            type="button"
            className={classes}
            style={{ left: pct(live.x), top: pct(live.y), width: pct(w), height: pct(h) }}
            title={`${p.label}${tag}`}
            aria-label={`${p.label}${tag}${p.hidden ? ' (hidden from players)' : ''}, square ${p.x + 1}, ${p.y + 1}`}
            aria-disabled={!p.movable || busy}
            onFocus={() => setSelected(p.key)}
            onPointerDown={(e) => {
              if (busy || !p.movable) return
              e.preventDefault()
              ;(e.currentTarget.parentElement as HTMLElement).setPointerCapture?.(e.pointerId)
              const at = toSquares(e)
              setSelected(p.key)
              setDrag({ key: p.key, dx: at.x - p.x, dy: at.y - p.y, x: p.x, y: p.y })
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Delete' || e.key === 'Backspace') && p.removable && onRemove && !busy) {
                e.preventDefault()
                onRemove(p.key)
                return
              }
              const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
              if (!step || busy || !p.movable) return
              e.preventDefault()
              drop(p, p.x + step[0], p.y + step[1])
            }}
          >
            {p.art ? <img src={p.art} alt="" draggable={false} /> : <span className="map-fallback">{p.fallback}</span>}
            {p.badge && <span className="map-badge">{p.badge}</span>}
            {p.removable && onRemove && selected === p.key && (
              <span
                role="button"
                tabIndex={-1}
                className="map-remove"
                title={`Remove ${p.label}`}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (!busy) onRemove(p.key)
                }}
              >
                ×
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
