// Square icon for a boon, evolution, combination or hidden boon, with a
// colored glow by kind and an initials placeholder when no picture loads.
import { useState } from 'react'
import { boonArt, type BoonArtRef } from '../boonLootArt'
import { cx, initials } from './tone'

export type BoonIconSize = 'sm' | 'md' | 'lg'

interface Props {
  art: BoonArtRef
  name: string
  size?: BoonIconSize
  dimmed?: boolean
  className?: string
}

const SIZES: Record<BoonIconSize, { box: string; text: string }> = {
  sm: { box: 'h-10 w-10', text: 'text-sm' },
  md: { box: 'h-16 w-16', text: 'text-lg' },
  lg: { box: 'h-24 w-24', text: 'text-3xl' },
}

const GLOW_CLASSES: Record<BoonArtRef['kind'], string | undefined> = {
  boon: undefined,
  evolution: 'boon-glow-evolution',
  combination: 'boon-glow-combination',
  hidden: 'boon-glow-hidden',
}

export function BoonIcon({ art, name, size = 'md', dimmed = false, className }: Props) {
  const urls = boonArt(art)
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const markFailed = (url: string) =>
    setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]))

  const hasFailed = urls.some((url) => failedUrls.includes(url))
  const [first, second] = urls

  return (
    <div
      role="img"
      aria-label={name}
      title={name}
      className={cx(
        'relative box-border shrink-0 overflow-hidden rounded-xl border border-stone-800 bg-stone-950',
        SIZES[size].box,
        GLOW_CLASSES[art.kind],
        dimmed && 'grayscale opacity-50',
        className,
      )}
    >
      {hasFailed || !first ? (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950"
        >
          <span className={cx('font-mono font-bold text-stone-600', SIZES[size].text)}>{initials(name)}</span>
        </div>
      ) : second ? (
        <>
          <img
            src={first}
            alt=""
            loading="lazy"
            onError={() => markFailed(first)}
            style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <img
            src={second}
            alt=""
            loading="lazy"
            onError={() => markFailed(second)}
            style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
            <line x1="0" y1="100" x2="100" y2="0" stroke="rgb(255 255 255 / 0.25)" strokeWidth="1.5" />
          </svg>
        </>
      ) : (
        <img
          src={first}
          alt=""
          loading="lazy"
          onError={() => markFailed(first)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}
