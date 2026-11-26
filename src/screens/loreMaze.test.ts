// Unit tests for deterministic orthogonal maze path generation in loreMaze.ts.
import { describe, expect, it } from 'vitest'
import { buildMazePaths, type MazePath } from './loreMaze'

function gridKey(x: number, y: number, sqLeft: number, sqTop: number, cell: number): string {
  const gx = Math.round((x - sqLeft) / cell)
  const gy = Math.round((y - sqTop) / cell)
  return `${gx},${gy}`
}

function assertValidFrameAndGrid(paths: MazePath[], width: number, height: number): void {
  const s = Math.min(width, height)
  const cell = s / 18
  const sqLeft = (width - s) / 2
  const sqRight = sqLeft + s
  const sqTop = (height - s) / 2
  const sqBottom = sqTop + s

  for (const path of paths) {
    expect(path.points.length).toBeGreaterThanOrEqual(2)
    expect(path.end).toEqual(path.points[path.points.length - 1])
    expect(path.d.startsWith('M ')).toBe(true)

    for (const [x, y] of path.points) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(width)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(height)

      const strictlyInsideSquare =
        x > sqLeft + 1e-6 &&
        x < sqRight - 1e-6 &&
        y > sqTop + 1e-6 &&
        y < sqBottom - 1e-6
      expect(strictlyInsideSquare).toBe(false)

      const gx = (x - sqLeft) / cell
      const gy = (y - sqTop) / cell
      expect(Math.abs(gx - Math.round(gx))).toBeLessThan(1e-6)
      expect(Math.abs(gy - Math.round(gy))).toBeLessThan(1e-6)
    }
  }
}

describe('buildMazePaths', () => {
  it('returns identical paths for identical inputs and differs for different seeds', () => {
    const a1 = buildMazePaths(1600, 900, '/art/boss-thils.png')
    const a2 = buildMazePaths(1600, 900, '/art/boss-thils.png')
    const b = buildMazePaths(1600, 900, '/art/boss-other.png')

    expect(a1).toEqual(a2)
    expect(a1).not.toEqual(b)
  })

  it('returns valid grid-aligned paths inside the frame and outside the square for 1600x900', () => {
    const paths = buildMazePaths(1600, 900, '/art/boss-1.png')

    expect(paths.length).toBeGreaterThanOrEqual(8)
    assertValidFrameAndGrid(paths, 1600, 900)
  })

  it('returns empty array for square or narrow-gap frames', () => {
    expect(buildMazePaths(900, 900, '/art/boss-1.png')).toEqual([])
    expect(buildMazePaths(930, 900, '/art/boss-1.png')).toEqual([])
  })

  it('returns paths whose points lie only in top/bottom gaps for 400x800 portrait', () => {
    const paths = buildMazePaths(400, 800, '/art/portrait-enemy.png')

    expect(paths.length).toBeGreaterThanOrEqual(8)
    assertValidFrameAndGrid(paths, 400, 800)

    const sqTop = 200
    const sqBottom = 600
    for (const path of paths) {
      for (const [, y] of path.points) {
        const inTopGap = y <= sqTop + 1e-6
        const inBottomGap = y >= sqBottom - 1e-6
        expect(inTopGap || inBottomGap).toBe(true)
      }
    }
  })

  it('never uses the same grid point as an interior vertex of two different paths', () => {
    const width = 1600
    const height = 900
    const s = Math.min(width, height)
    const cell = s / 18
    const sqLeft = (width - s) / 2
    const sqTop = (height - s) / 2
    const paths = buildMazePaths(width, height, '/art/overlap-check.png')

    const interiorVertices = new Set<string>()
    for (const path of paths) {
      for (let i = 1; i < path.points.length - 1; i++) {
        const [x, y] = path.points[i]
        const k = gridKey(x, y, sqLeft, sqTop, cell)
        expect(interiorVertices.has(k)).toBe(false)
        interiorVertices.add(k)
      }
    }
  })

  it('spawns branched paths with depth > 0 for 1600x900', () => {
    const paths = buildMazePaths(1600, 900, '/art/branch-seed.png')

    expect(paths.some((p) => p.depth > 0)).toBe(true)
    expect(paths.every((p) => p.depth <= 2)).toBe(true)
  })
})
