import { useId } from 'react'

// Concentric orthogonal labyrinth rings (inner 40, middle 45, outer 49 half-size) with doorways,
// perpendicular ring connectors (grouped by their inner ring index), and short dead-end stubs.
const MAZE_RINGS: readonly (readonly string[])[] = [
  [
    // Ring 0 (10..90)
    'M 10 34 V 10 H 40',
    'M 52 10 H 90 V 44',
    'M 90 56 V 90 H 58',
    'M 46 90 H 10 V 66',
    'M 10 54 V 42',
    // Connectors 0 -> 1
    'M 18 10 V 5',
    'M 64 10 V 5',
    'M 90 68 H 95',
    'M 34 90 V 95',
    'M 10 78 H 5',
    // Ring 0 stubs
    'M 90 26 H 93',
    'M 28 10 V 7',
  ],
  [
    // Ring 1 (5..95)
    'M 5 22 V 5 H 20',
    'M 30 5 H 72',
    'M 82 5 H 95 V 26',
    'M 95 36 V 95 H 74',
    'M 64 95 H 28',
    'M 18 95 H 5 V 32',
    // Connectors 1 -> 2
    'M 42 5 V 1',
    'M 95 16 H 99',
    'M 56 95 V 99',
    'M 5 62 H 1',
    // Ring 1 stubs
    'M 54 5 V 7.5',
    'M 5 46 H 2.5',
  ],
  [
    // Ring 2 (1..99)
    'M 1 44 V 1 H 52',
    'M 62 1 H 99 V 60',
    'M 99 70 V 99 H 88',
    'M 78 99 H 46',
    'M 36 99 H 1 V 54',
    // Ring 2 stubs
    'M 18 99 V 97',
    'M 82 1 V 3',
  ],
]

const MASK_GRADIENT = 'radial-gradient(farthest-corner, black 55%, transparent 100%)'

/** Glowing orthogonal maze overlay drawn outside a card for maze-patterned accents. */
export function MazeGlow({
  color,
  svgRef,
  className = 'pointer-events-none absolute -inset-6',
}: {
  color: string
  svgRef: (el: SVGSVGElement | null) => void
  className?: string
}) {
  const uid = useId()
  const filterId = `${uid}-maze-glow`

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        maskImage: MASK_GRADIENT,
        WebkitMaskImage: MASK_GRADIENT,
      }}
      className={className}
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
        {MAZE_RINGS.map((paths, ring) =>
          paths.map((d) => (
            <path
              key={d}
              d={d}
              data-maze-ring={ring}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinecap="square"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
            />
          )),
        )}
      </g>
    </svg>
  )
}
