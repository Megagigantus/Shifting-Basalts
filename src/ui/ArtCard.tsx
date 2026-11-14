// The "art card": a picture with a dark fade at the bottom, a title in the
// bottom-left and an optional pill in the bottom-right. Clicking it opens the
// picture in the shared lightbox.
//
// When no picture has been added for this id (or it fails to load), it shows a
// plain placeholder with the item's initials, so screens never break.
//
// Callers decide visibility: only pass ids the viewer is allowed to see.
import { useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { artUrl, type ArtKind } from '../art'
import { useLightbox, type LightboxArt } from './lightboxContext'
import { cx, initials, toneClasses, type Tone } from './tone'

interface Props {
  kind: ArtKind
  id: string
  title: string
  subtitle?: ReactNode
  /** Pill in the bottom-right corner, e.g. "Lv 8" or "Locked". */
  badge?: ReactNode
  /** Accent border; stone (neutral) by default. */
  tone?: Tone
  /** Picture shape: wide banner, square tile or a tall portrait. */
  shape?: 'banner' | 'square' | 'portrait'
  /** Extra lightbox details (text, a second picture). Set false to turn the lightbox off. */
  lightbox?: Partial<Omit<LightboxArt, 'src'>> | false
  /** Runs instead of opening the lightbox, e.g. to choose a station. */
  onClick?: () => void
  className?: string
}

const SHAPES = {
  banner: 'aspect-[16/7]',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
}

export function ArtCard({ kind, id, title, subtitle, badge, tone = 'stone', shape = 'banner', lightbox, onClick, className }: Props) {
  const url = artUrl(kind, id)
  const [failed, setFailed] = useState(false)
  const showArt = useLightbox()
  const hasPicture = url !== null && !failed

  const canOpen = onClick !== undefined || (hasPicture && lightbox !== false)
  const handleClick = () => {
    if (onClick) return onClick()
    if (url && !failed && lightbox !== false) showArt({ title, ...(lightbox || {}), src: url })
  }

  const content = (
    <>
      {hasPicture ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950">
          <span className="font-mono text-3xl font-bold text-stone-600">{initials(title)}</span>
        </div>
      )}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 text-left">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-stone-50 drop-shadow">{title}</div>
          {subtitle && <div className="truncate text-[11px] text-stone-300">{subtitle}</div>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {canOpen && !onClick && (
        <Maximize2 aria-hidden="true" size={14} className="absolute right-2 top-2 text-stone-200/70 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </>
  )

  const frame = cx(
    'group relative block w-full overflow-hidden rounded-xl border bg-stone-950 p-0',
    SHAPES[shape],
    toneClasses[tone].border,
    className,
  )

  if (!canOpen) return <div className={frame}>{content}</div>
  return (
    <button type="button" onClick={handleClick} aria-label={onClick ? title : `Enlarge ${title}`} className={cx(frame, 'cursor-pointer')}>
      {content}
    </button>
  )
}
