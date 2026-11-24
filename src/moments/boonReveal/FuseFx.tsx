import { boon } from '../../rules/boons'
import { BoonIcon, type BoonIconSize } from '../../ui/BoonIcon'

export interface FuseRefs {
  left: HTMLDivElement | null
  right: HTMLDivElement | null
  flash: HTMLDivElement | null
  shock: HTMLDivElement | null
}

/** Mini source boon cards, radial flash, and expanding shockwave ring for Fusion reveals. */
export function FuseFx({
  color,
  sourceIds,
  setRef,
  roundedClass = 'rounded-xl',
  iconSize = 'md',
}: {
  color: string
  sourceIds: readonly string[]
  setRef: (key: keyof FuseRefs, el: Element | null) => void
  roundedClass?: string
  iconSize?: BoonIconSize
}) {
  const [leftId, rightId] = sourceIds
  if (!leftId || !rightId) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20">
      {(
        [
          ['left', leftId],
          ['right', rightId],
        ] as const
      ).map(([key, id]) => {
        const name = boon(id).name
        return (
          <div
            key={key}
            ref={(el) => setRef(key, el)}
            aria-hidden="true"
            style={{
              border: `1px solid ${color}`,
              boxShadow: `0 0 14px ${color}55`,
            }}
            className="pointer-events-none absolute inset-0 m-auto flex h-[58%] w-[58%] flex-col items-center justify-center gap-1 rounded-lg bg-gradient-to-b from-stone-800 to-stone-950 p-1.5 text-center"
          >
            <BoonIcon art={{ kind: 'boon', id }} name={name} size={iconSize} />
            <span className="line-clamp-2 text-[10px] font-bold leading-tight text-stone-100">
              {name}
            </span>
          </div>
        )
      })}

      <div
        ref={(el) => setRef('flash', el)}
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle, #ffffff 0%, ${color} 55%, transparent 100%)`,
        }}
        className={`pointer-events-none absolute inset-0 ${roundedClass}`}
      />

      <div
        ref={(el) => setRef('shock', el)}
        aria-hidden="true"
        style={{
          border: `3px solid ${color}`,
          boxShadow: `0 0 24px 4px ${color}`,
        }}
        className="pointer-events-none absolute inset-x-0 top-[12.5%] aspect-square w-full rounded-full"
      />
    </div>
  )
}
