// The room as a picture: shape banner with a lighting tint, then icon tiles
// for terrain, tricks and exits. Shared by the DM and player rooms. Each
// caller passes only what its viewer may see; the DM can mark items as hidden
// so they show dashed and dimmed. Renders nothing until at least one picture
// exists. Clicking a picture enlarges it.
import type { CSSProperties } from 'react'
import { artUrl, type ArtKind } from '../art'
import { lightingName, shapeOf, sizeOf, terrainOf, trickOf } from '../rules/rooms'
import { useLightbox } from '../ui/lightboxContext'
import { cx } from '../ui/tone'

interface Props {
  shape: string
  size: string
  lighting: string
  exits: number
  /** The true exit's number, or null when the viewer doesn't know it. */
  trueExit: number | null
  terrain: string[]
  tricks: string[]
  /** DM only: ids (terrain or trick) players can't see yet. */
  hidden?: Set<string>
  /** Small line above the shape name, e.g. "Floor 1 · Room 2 · Combat". */
  eyebrow?: string
}

interface Icon {
  kind: ArtKind
  id: string
  name: string
  url: string
}

/**
 * A wash over the banner so the lighting shows (same tints as before the
 * redesign). Flickering uses the room-flicker animation from index.css.
 */
const LIGHT_TINT: Record<string, CSSProperties> = {
  'dim-seam-light': { background: 'rgb(10 10 20 / 0.45)' },
  'golden-light': { background: 'linear-gradient(to top, rgb(230 170 60 / 0.35), transparent 70%)' },
  flickering: { background: 'rgb(10 10 20 / 0.55)' },
  'magical-darkness': {
    background:
      'radial-gradient(circle at 25% 35%, rgb(0 0 0 / 0.85) 0 18%, transparent 30%), radial-gradient(circle at 70% 65%, rgb(0 0 0 / 0.85) 0 15%, transparent 27%)',
  },
}

export function RoomCard({ shape, size, lighting, exits, trueExit, terrain, tricks, hidden, eyebrow }: Props) {
  const showArt = useLightbox()
  const shapeUrl = artUrl('shapes', shape)
  const icons: Icon[] = [
    ...terrain.map((id) => ({ kind: 'terrain' as ArtKind, id, name: terrainOf(id).name })),
    ...tricks.map((id) => ({ kind: 'tricks' as ArtKind, id, name: trickOf(id).name })),
  ].flatMap((i) => {
    const url = artUrl(i.kind, i.id)
    return url ? [{ ...i, url }] : []
  })
  const exitIds = Array.from({ length: exits }, (_, i) => (i + 1 === trueExit ? 'true-exit' : 'exit'))
  const showExits = exitIds.some((id) => artUrl('exits', id))

  if (!shapeUrl && icons.length === 0 && !showExits) return null

  const caption = `${shapeOf(shape).name} · ${sizeOf(size).name} (${sizeOf(size).feet} ft) · ${lightingName(lighting)}`

  return (
    <figure className="m-0 flex flex-col gap-2.5">
      {shapeUrl && (
        <button
          type="button"
          onClick={() => showArt({ src: shapeUrl, title: shapeOf(shape).name, subtitle: caption, description: shapeOf(shape).description })}
          className="group relative box-border block aspect-[16/6] max-h-64 w-full cursor-pointer overflow-hidden rounded-xl border border-amber-500/30 bg-stone-950 p-0"
          aria-label={`Enlarge ${shapeOf(shape).name}`}
        >
          <img src={shapeUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
          <div
            aria-hidden="true"
            style={LIGHT_TINT[lighting]}
            className={cx('absolute inset-0', lighting === 'flickering' && 'animate-[room-flicker_3s_steps(2,jump-none)_infinite] motion-reduce:animate-none')}
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
          <figcaption className="absolute inset-x-0 bottom-0 p-3 text-left">
            {eyebrow && <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">{eyebrow}</div>}
            <div className="text-base font-bold text-stone-50 drop-shadow">{shapeOf(shape).name}</div>
            <div className="text-[11px] text-stone-300">
              {sizeOf(size).name} ({sizeOf(size).feet} ft) · {lightingName(lighting)}
            </div>
          </figcaption>
        </button>
      )}
      {(icons.length > 0 || showExits) && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {icons.map((i) => {
            const isHidden = hidden?.has(i.id)
            return (
              <li key={`${i.kind}-${i.id}`} className="w-16 text-center">
                <button
                  type="button"
                  onClick={() => showArt({ src: i.url, title: i.name, subtitle: isHidden ? 'Hidden from players' : undefined })}
                  className={cx(
                    'box-border block h-16 w-16 cursor-pointer overflow-hidden rounded-lg border bg-stone-950 p-0',
                    isHidden ? 'border-dashed border-rose-500/60 opacity-55' : 'border-stone-700',
                  )}
                  aria-label={`Enlarge ${i.name}`}
                  title={isHidden ? `${i.name} (hidden from players)` : i.name}
                >
                  <img src={i.url} alt="" className="h-full w-full object-cover" />
                </button>
                <span className="mt-1 block text-[10px] leading-tight text-stone-400">{i.name}</span>
              </li>
            )
          })}
          {showExits &&
            exitIds.map((id, n) => {
              const url = artUrl('exits', id)
              return (
                <li key={`exit-${n}`} className="w-12 text-center">
                  <span
                    className={cx(
                      'box-border block h-12 w-12 overflow-hidden rounded-lg border bg-stone-950',
                      id === 'true-exit' ? 'border-emerald-500/60' : 'border-stone-700',
                    )}
                    title={id === 'true-exit' ? `Doorway ${n + 1}, true exit` : `Doorway ${n + 1}`}
                  >
                    {url && <img src={url} alt={id === 'true-exit' ? `Doorway ${n + 1}, true exit` : `Doorway ${n + 1}`} className="h-full w-full object-cover" />}
                  </span>
                  <span className="mt-1 block text-[10px] text-stone-400">#{n + 1}</span>
                </li>
              )
            })}
        </ul>
      )}
    </figure>
  )
}
