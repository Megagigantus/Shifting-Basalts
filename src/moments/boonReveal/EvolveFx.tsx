import { useId } from 'react'

export interface EvolveRefs {
  cracks: SVGSVGElement | null
  flash: HTMLDivElement | null
  shock: HTMLDivElement | null
}

// Six jagged fracture paths radiating from near the card centre, with short side branches.
const CRACK_PATHS: readonly string[] = [
  'M 49 48 L 42 36 L 35 32 L 26 20 L 18 14 L 8 4 M 35 32 L 38 22 L 34 15',
  'M 51 47 L 59 38 L 67 34 L 74 23 L 84 17 L 94 6 M 67 34 L 76 37 L 83 33',
  'M 53 51 L 64 49 L 73 54 L 85 50 L 98 55',
  'M 51 53 L 58 64 L 65 70 L 72 82 L 82 88 L 91 98 M 65 70 L 58 78 L 61 86',
  'M 48 53 L 40 62 L 33 70 L 24 77 L 17 87 L 7 96',
  'M 46 50 L 36 47 L 26 52 L 15 48 L 3 53 M 26 52 L 22 61 L 15 64',
]

/** Glowing energy cracks, white flash, and expanding shockwave ring for Evolution reveals. */
export function EvolveFx({
  color,
  roundedClass = 'rounded-xl',
  setRef,
}: {
  color: string
  roundedClass?: string
  setRef: (key: keyof EvolveRefs, el: Element | null) => void
}) {
  const uid = useId()
  const filterId = `${uid}-evolve-cracks`

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 overflow-hidden ${roundedClass}`}
      >
        <svg
          ref={(el) => setRef('cracks', el)}
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <filter id={filterId} x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={1.2} result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter={`url(#${filterId})`}>
            {CRACK_PATHS.map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
              />
            ))}
          </g>
          {CRACK_PATHS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={0.6}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
            />
          ))}
        </svg>
      </div>

      <div
        ref={(el) => setRef('flash', el)}
        aria-hidden="true"
        style={{ backgroundColor: '#ffffff' }}
        className={`pointer-events-none absolute inset-0 ${roundedClass}`}
      />

      <div
        ref={(el) => setRef('shock', el)}
        aria-hidden="true"
        style={{
          border: `3px solid ${color}`,
          boxShadow: `0 0 24px 4px ${color}`,
        }}
        className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-full -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
    </>
  )
}
