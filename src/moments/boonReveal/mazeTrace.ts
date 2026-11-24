// Timeline helpers for the outward-tracing maze glow overlay (see MazeGlow.tsx).
import gsap from 'gsap'

const RING_COUNT = 3
const RING_STAGGER_RATIO = 0.2

/** Reset the maze SVG to hidden with every path dash offset ready to trace in. */
export function resetMaze(svg: SVGSVGElement | null): void {
  if (!svg) return
  gsap.set(svg, { opacity: 0 })
  const paths = svg.querySelectorAll('path')
  if (paths.length > 0) {
    gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 })
  }
}

/** Add the outward ring-by-ring maze trace (or fade under reduced motion) to a GSAP timeline. */
export function addMazeTrace(
  tl: gsap.core.Timeline,
  svg: SVGSVGElement | null,
  opts: {
    start: number
    traceSec: number
    restOpacity: number
    reducedMotion: boolean
  },
): void {
  if (!svg) return
  const { start, traceSec, restOpacity, reducedMotion } = opts
  const allPaths = svg.querySelectorAll('path')

  if (reducedMotion) {
    if (allPaths.length > 0) {
      tl.set(allPaths, { strokeDashoffset: 0 }, start)
    }
    tl.fromTo(
      svg,
      { opacity: 0 },
      { opacity: restOpacity, duration: traceSec, ease: 'none', immediateRender: false },
      start,
    )
    return
  }

  tl.to(svg, { opacity: 1, duration: 0.15, ease: 'power1.out' }, start)

  const staggerSec = traceSec * RING_STAGGER_RATIO
  const drawSec = Math.max(0.01, traceSec - (RING_COUNT - 1) * staggerSec)
  for (let ring = 0; ring < RING_COUNT; ring++) {
    const ringPaths = svg.querySelectorAll(`path[data-maze-ring="${ring}"]`)
    if (ringPaths.length === 0) continue
    tl.to(
      ringPaths,
      { strokeDashoffset: 0, duration: drawSec, ease: 'power2.out' },
      start + ring * staggerSec,
    )
  }

  tl.to(svg, { opacity: restOpacity, duration: 0.5, ease: 'power1.out' }, start + traceSec)
}
