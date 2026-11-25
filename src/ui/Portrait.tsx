// Round character portrait (or initials fallback) with full-clear glow,
// diamond pips, full Hall of Echoes collection badge, and full lore collection laurel.
import { BookOpen, Diamond } from 'lucide-react'
import { artUrl } from '../art'
import { honorClasses, NO_HONORS, type PortraitHonors } from '../rules/portraitHonors'
import { cx, initials } from './tone'

interface Props {
  portrait?: string
  name: string
  size?: string
  honors?: PortraitHonors
  badgeSize?: number
  className?: string
}

const LAUREL_LEAF = 'M 0 0 C 3 -3.5 8 -3.2 12 0 C 8 3.2 3 3.5 0 0 Z'

const LAUREL_LEAVES: ReadonlyArray<{ x: number; y: number; rot: number; scale?: number }> = [
  { x: 27.4, y: 83.6, rot: -164 },
  { x: 18.1, y: 75.0, rot: -112 },
  { x: 11.7, y: 63.2, rot: -127 },
  { x: 9.5, y: 49.3, rot: -73 },
  { x: 11.9, y: 36.1, rot: -88 },
  { x: 18.5, y: 24.5, rot: -35 },
  { x: 27.4, y: 16.4, rot: -34, scale: 0.92 },
]

function LaurelBranch() {
  return (
    <>
      <path d="M 32.2 86.4 A 40.5 40.5 0 0 1 27.4 16.4" fill="none" stroke="#38bdf8" strokeWidth={1.4} strokeLinecap="round" />
      {LAUREL_LEAVES.map((leaf, i) => (
        <path
          key={i}
          d={LAUREL_LEAF}
          fill="#7dd3fc"
          stroke="#38bdf8"
          strokeWidth={0.7}
          transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.rot})${leaf.scale ? ` scale(${leaf.scale})` : ''}`}
        />
      ))}
    </>
  )
}

function honorTitle(honors: PortraitHonors): string | undefined {
  const parts: string[] = []
  if (honors.fullClears > 0) {
    parts.push(honors.fullClears === 1 ? '1 full clear' : `${honors.fullClears} full clears`)
  }
  if (honors.fullCollection) {
    parts.push('Full Hall of Echoes collection')
  }
  if (honors.loreLaurel) {
    parts.push('Full lore collection')
  }
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export function Portrait({ portrait, name, size = 'h-10 w-10', honors = NO_HONORS, badgeSize = 10, className }: Props) {
  const url = portrait ? artUrl('portraits', portrait) : null
  const glow = honorClasses(honors)

  return (
    <span title={honorTitle(honors)} className={cx('relative inline-flex shrink-0', className)}>
      {url ? (
        <img src={url} alt="" className={cx(size, 'shrink-0 rounded-full border border-stone-700 object-cover', glow)} />
      ) : (
        <span
          className={cx(
            size,
            glow,
            'flex shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-stone-400',
          )}
        >
          {initials(name)}
        </span>
      )}
      {honors.loreLaurel && (
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          className="pointer-events-none absolute -inset-[20%] h-[140%] w-[140%] overflow-visible drop-shadow-[0_0_3px_rgb(56_189_248/0.9)]"
        >
          <LaurelBranch />
          <g transform="translate(100 0) scale(-1 1)">
            <LaurelBranch />
          </g>
        </svg>
      )}
      {honors.diamonds > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1.5 left-1/2 flex -translate-x-1/2 items-center gap-px drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]"
        >
          {Array.from({ length: honors.diamonds }, (_, i) => (
            <Diamond key={i} size={badgeSize} className="fill-sky-300 text-sky-200" />
          ))}
        </span>
      )}
      {honors.fullCollection && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full bg-emerald-600 p-0.5 text-emerald-50 ring-1 ring-emerald-300 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]"
        >
          <BookOpen size={badgeSize} />
        </span>
      )}
    </span>
  )
}
