import { useId } from 'react'

type LingerProps = {
  color: string
  className?: string
  still?: boolean
  svgRef?: (el: SVGSVGElement | null) => void
}

const ORBIT_PATH = 'M 1 62.5 A 49 14 0 1 0 99 62.5 A 49 14 0 1 0 1 62.5'

const ORBITS: readonly {
  angle: number
  dur: string
  begin: string
  stillTheta: number
}[] = [
  { angle: -30, dur: '2.4s', begin: '0s', stillTheta: 0.45 },
  { angle: 30, dur: '3.1s', begin: '-0.8s', stillTheta: 2.25 },
  { angle: 90, dur: '3.8s', begin: '-1.9s', stillTheta: 4.1 },
]

const ARC_PATHS: readonly string[] = [
  'M 8 4 L 15 1.5 L 22 5.5 L 29 2 L 36 5 L 43 1.5',
  'M 76 2.5 L 84 5.5 L 91 1.5 L 97.5 4.5 L 95.5 11 L 98.5 18 L 95 25',
  'M 96 42 L 98.5 50 L 94.5 58 L 98 66 L 95 74 L 97.5 82',
  'M 98 86 L 94.5 92 L 97.5 97.5 L 90 95 L 82 98.5 L 74 95.5',
  'M 62 96 L 54 98.5 L 47 94.5 L 39 98 L 31 95 L 24 98.5',
  'M 14 97.5 L 7 94.5 L 2 97.5 L 5 90 L 1.5 82 L 5 74',
  'M 4.5 56 L 1.5 48 L 5.5 40 L 2 32 L 5.5 23 L 2 14 L 5 7',
]

const ARC_TIMINGS: readonly { duration: string; delay: string }[] = [
  { duration: '1.3s', delay: '0s' },
  { duration: '1.9s', delay: '0.45s' },
  { duration: '1.1s', delay: '1.1s' },
  { duration: '2.2s', delay: '0.2s' },
  { duration: '1.5s', delay: '0.85s' },
  { duration: '0.95s', delay: '1.4s' },
  { duration: '1.75s', delay: '0.6s' },
]

/** Three tilted atomic orbits with glowing electrons and a pulsing core (Fusion boons; set per tier in moment-theme.json). */
export function AtomOrbit({
  color,
  className = 'pointer-events-none absolute -inset-14',
  still = false,
  svgRef,
}: LingerProps) {
  const uid = useId()
  const glowFilterId = `${uid}-atom-glow`
  const coreGradientId = `${uid}-atom-core`

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <defs>
        <filter
          id={glowFilterId}
          filterUnits="userSpaceOnUse"
          x="-15"
          y="-15"
          width="130"
          height="155"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={1.5} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={coreGradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </radialGradient>
      </defs>

      <circle
        cx={50}
        cy={62.5}
        r={30}
        fill={`url(#${coreGradientId})`}
        className={still ? undefined : 'linger-atom-core'}
      />

      {ORBITS.map(({ angle, dur, begin, stillTheta }) => (
        <g key={angle} transform={`rotate(${angle} 50 62.5)`}>
          <ellipse
            cx={50}
            cy={62.5}
            rx={49}
            ry={14}
            fill="none"
            stroke={color}
            strokeWidth={0.9}
            strokeOpacity={0.8}
          />
          <circle
            cx={still ? 50 + 49 * Math.cos(stillTheta) : 0}
            cy={still ? 62.5 + 14 * Math.sin(stillTheta) : 0}
            r={2.8}
            fill={color}
            filter={`url(#${glowFilterId})`}
          >
            {!still && (
              <animateMotion
                path={ORBIT_PATH}
                dur={dur}
                begin={begin}
                repeatCount="indefinite"
              />
            )}
          </circle>
        </g>
      ))}
    </svg>
  )
}

/** Crackling electric arcs hugging a card's edges (Evolution boons; set per tier in moment-theme.json). */
export function ElectricArcs({
  color,
  className = 'pointer-events-none absolute -inset-2',
  still = false,
  svgRef,
}: LingerProps) {
  const uid = useId()
  const glowFilterId = `${uid}-arc-glow`

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
    >
      <defs>
        <filter
          id={glowFilterId}
          filterUnits="userSpaceOnUse"
          x="-15"
          y="-15"
          width="130"
          height="130"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={1} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {ARC_PATHS.map((d, i) => {
        const { duration, delay } = ARC_TIMINGS[i]
        return (
          <g
            key={d}
            className={still ? undefined : 'linger-arc'}
            style={
              still
                ? { opacity: 0.45 }
                : { animationDelay: delay, animationDuration: duration }
            }
          >
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.4}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              filter={`url(#${glowFilterId})`}
            />
            <path
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth={0.5}
              strokeOpacity={0.8}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}
