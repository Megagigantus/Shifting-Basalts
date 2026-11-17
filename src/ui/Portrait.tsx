// Round character portrait (or initials fallback) with full-clear glow,
// diamond pips, and full Basalt Echoes collection badge.
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

function honorTitle(honors: PortraitHonors): string | undefined {
  const parts: string[] = []
  if (honors.fullClears > 0) {
    parts.push(honors.fullClears === 1 ? '1 full clear' : `${honors.fullClears} full clears`)
  }
  if (honors.fullCollection) {
    parts.push('Full Basalt Echoes collection')
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
