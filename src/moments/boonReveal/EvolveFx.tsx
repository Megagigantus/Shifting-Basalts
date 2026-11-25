import { useId } from 'react'

export interface EvolveRefs {
  cracks: SVGSVGElement | null
  flash: HTMLDivElement | null
  shock: HTMLDivElement | null
  bolt: HTMLDivElement | null
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
        className="pointer-events-none absolute inset-x-0 top-[12.5%] aspect-square w-full rounded-full"
      />
    </>
  )
}

// Jagged lightning bolt from top of viewport to card centre, with two short side forks.
const BOLT_PATHS: readonly string[] = [
  'M 54 0 L 42 130 L 62 240 L 34 390 L 60 510 L 30 670 L 58 790 L 44 910 L 50 1000',
  'M 62 240 L 78 310 L 72 375',
  'M 30 670 L 14 745 L 22 810',
]

/** Lightning bolt shooting down from the top of the screen onto an Evolution card at flip time. */
export function LightningStrike({
  color,
  setRef,
}: {
  color: string
  setRef: (el: HTMLDivElement | null) => void
}) {
  const uid = useId()
  const filterId = `${uid}-evolve-bolt`

  return (
    <div
      ref={setRef}
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 bottom-1/2 h-[100vh] w-3/5 -translate-x-1/2"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <filter id={filterId} x="-30%" y="-5%" width="160%" height="110%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={3} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          {BOLT_PATHS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={5}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        {BOLT_PATHS.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  )
}
