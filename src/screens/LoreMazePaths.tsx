// Draws animated glowing orthogonal maze paths over the blurred backdrop of square lore art.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { usePrefersReducedMotion } from '../moments/device'
import { accentById } from '../moments/theme'
import { buildMazePaths } from './loreMaze'

const THILS_ACCENT = accentById('thils')
// Lore art sits on a dark blur, so the maze rests brighter than on boon cards.
const REST_OPACITY = Math.max(0.85, THILS_ACCENT.glowPatternOpacity ?? 0.5)
// Fade only toward the outer frame edges, along the axis the gaps sit on.
const maskFor = (wide: boolean) =>
  `linear-gradient(${wide ? 'to right' : 'to bottom'}, transparent 0%, black 14%, black 86%, transparent 100%)`

const KEYFRAMES_CSS = `
@keyframes lore-maze-trace {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}
@keyframes lore-maze-dot {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes lore-maze-settle {
  from { opacity: 1; }
  to { opacity: var(--lore-maze-rest, 0.5); }
}
@keyframes lore-maze-pulse {
  0%, 100% { opacity: var(--lore-maze-rest, 0.5); }
  35% { opacity: 1; }
  75% { opacity: 0.65; }
}
`

export function LoreMazePaths({ seed }: { seed: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const uid = useId()
  const filterId = `${uid}-lore-maze-glow`

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      if (width > 0 && height > 0) {
        setSize((prev) =>
          prev && prev.width === width && prev.height === height ? prev : { width, height },
        )
      }
    }

    update()

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const paths = useMemo(
    () => (size ? buildMazePaths(size.width, size.height, seed) : []),
    [size, seed],
  )

  const minDim = size ? Math.min(size.width, size.height) : 0
  const strokeWidth = Math.min(3, Math.max(1.5, 1 + minDim / 400))
  const dotRadius = Math.min(3, Math.max(2, strokeWidth * 1.35))
  const blurStdDev = Math.max(2.5, strokeWidth * 2.2)

  const svgStyle: CSSProperties & { '--lore-maze-rest': number } = {
    '--lore-maze-rest': REST_OPACITY,
    maskImage: maskFor(size ? size.width >= size.height : true),
    WebkitMaskImage: maskFor(size ? size.width >= size.height : true),
    opacity: reducedMotion ? REST_OPACITY : 1,
    animation: reducedMotion
      ? undefined
      : 'lore-maze-settle 0.6s ease-out 2.1s forwards, lore-maze-pulse 4s ease-in-out 2.7s infinite',
  }

  return (
    <div ref={containerRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {size && paths.length > 0 && (
        <>
          {!reducedMotion && <style>{KEYFRAMES_CSS}</style>}
          <svg
            key={seed}
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            className="h-full w-full"
            style={svgStyle}
          >
            <defs>
              <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation={blurStdDev} result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g filter={`url(#${filterId})`}>
              {paths.map((path, index) => {
                const traceDelay = 0.3 + path.depth * 0.35
                const dotDelay = traceDelay + 1.1
                return (
                  <g key={`${index}-${path.d}`}>
                    <path
                      d={path.d}
                      fill="none"
                      stroke={THILS_ACCENT.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="square"
                      pathLength={1}
                      strokeDasharray={1}
                      style={
                        reducedMotion
                          ? { strokeDashoffset: 0 }
                          : {
                              strokeDashoffset: 1,
                              animation: `lore-maze-trace 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${traceDelay}s forwards`,
                            }
                      }
                    />
                    <circle
                      cx={path.end[0]}
                      cy={path.end[1]}
                      r={dotRadius}
                      fill={THILS_ACCENT.color}
                      style={
                        reducedMotion
                          ? { opacity: 1 }
                          : {
                              opacity: 0,
                              animation: `lore-maze-dot 0.3s ease-out ${dotDelay}s forwards`,
                            }
                      }
                    />
                  </g>
                )
              })}
            </g>
          </svg>
        </>
      )}
    </div>
  )
}
