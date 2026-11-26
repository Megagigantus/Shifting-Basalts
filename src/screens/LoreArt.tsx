// Renders lore card art: fills the frame for wide 16:9 images, or centers
// square/tall art whole over a blurred, darkened backdrop copy.
import { useState, type CSSProperties, type SyntheticEvent } from 'react'
import { cx } from '../ui/tone'
import { LoreMazePaths } from './LoreMazePaths'

export interface LoreArtProps {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
  imgClassName?: string
  onError?: () => void
}

type AspectMode = 'wide' | 'contain'

export function LoreArt({
  src,
  alt = '',
  className,
  style,
  imgClassName,
  onError,
}: LoreArtProps) {
  const [measured, setMeasured] = useState<{ src: string; mode: AspectMode } | null>(null)
  const mode = measured?.src === src ? measured.mode : null
  const isPositioned = Boolean(className && /\b(absolute|fixed|sticky)\b/.test(className))

  function handleLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = e.currentTarget
    const nextMode: AspectMode =
      naturalWidth > 0 && naturalHeight > 0 && naturalWidth / naturalHeight < 1.5
        ? 'contain'
        : 'wide'
    setMeasured({ src, mode: nextMode })
  }

  return (
    <div
      className={cx(!isPositioned && 'relative', 'h-full w-full overflow-hidden', className)}
      style={style}
    >
      {mode === 'contain' && (
        <>
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 select-none object-cover blur-2xl brightness-[0.45]"
          />
          <LoreMazePaths seed={src} />
        </>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={onError}
        className={cx(
          'pointer-events-none absolute inset-0 h-full w-full select-none',
          mode === null && 'opacity-0',
          mode === 'contain' ? 'object-contain' : 'object-cover',
          imgClassName,
        )}
      />
    </div>
  )
}
