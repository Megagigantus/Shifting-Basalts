// Generates deterministic orthogonal maze paths branching outward from a centered square into frame gaps.
import { loreMazeStyle } from '../moments/theme'

export type MazePoint = [number, number]

export interface MazePath {
  d: string
  depth: number
  points: MazePoint[]
  end: MazePoint
}

export interface MazeOptions {
  rootsMin: number
  rootsMax: number
  maxRootSegments: number
  maxDepth: number
  branchProbability: number
}

interface GridCoord {
  gx: number
  gy: number
}

interface BranchTask {
  gx: number
  gy: number
  depth: number
  dir: [number, number]
  outward: [number, number]
  isInGap: (gx: number, gy: number) => boolean
}

const GRID_CELLS = 18
const MIN_GAP_PX = 16

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function createRng(seed: string): () => number {
  let state = hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickStartIndices(rng: () => number, rootsMin: number, rootsMax: number): number[] {
  const spanCount = Math.max(1, rootsMax - rootsMin + 1)
  const count = rootsMin + Math.floor(rng() * spanCount)
  const span = GRID_CELLS - 1
  const indices: number[] = []
  for (let i = 0; i < count; i++) {
    const lo = 1 + Math.floor((i * span) / count)
    const hi = Math.floor(((i + 1) * span) / count)
    indices.push(lo + Math.floor(rng() * (hi - lo + 1)))
  }
  return indices
}

function shuffle<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = items[i]
    items[i] = items[j]
    items[j] = tmp
  }
}

function formatCoord(n: number): string {
  const rounded = Math.round(n * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function buildSvgPathD(points: MazePoint[]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${formatCoord(x)} ${formatCoord(y)}`)
    .join(' ')
}

function coordKey(gx: number, gy: number): string {
  return `${gx},${gy}`
}

/** Build deterministic orthogonal maze paths in pixel coordinates for a width x height frame. */
export function buildMazePaths(
  width: number,
  height: number,
  seed: string,
  options?: Partial<MazeOptions>,
): MazePath[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return []
  }

  const s = Math.min(width, height)
  const gap = (Math.max(width, height) - s) / 2
  if (gap < MIN_GAP_PX) {
    return []
  }

  const defaults = loreMazeStyle(null)
  const opts: MazeOptions = {
    rootsMin: options?.rootsMin ?? defaults.rootsMin,
    rootsMax: options?.rootsMax ?? defaults.rootsMax,
    maxRootSegments: options?.maxRootSegments ?? defaults.maxRootSegments,
    maxDepth: options?.maxDepth ?? defaults.maxDepth,
    branchProbability: options?.branchProbability ?? defaults.branchProbability,
  }

  const cell = s / GRID_CELLS
  const sqLeft = (width - s) / 2
  const sqTop = (height - s) / 2

  const toPixel = (gx: number, gy: number): MazePoint => [
    sqLeft + gx * cell,
    sqTop + gy * cell,
  ]

  const inFrame = (gx: number, gy: number): boolean => {
    const [x, y] = toPixel(gx, gy)
    return x >= 0 && x <= width && y >= 0 && y <= height
  }

  const rng = createRng(seed)
  const occupied = new Set<string>()
  const queue: BranchTask[] = []
  const results: MazePath[] = []

  const walkTask = (task: BranchTask): void => {
    const { gx: startGx, gy: startGy, depth, outward, isInGap } = task
    const maxSegments = depth === 0 ? opts.maxRootSegments : 1 + Math.floor(rng() * 3)
    const gridPoints: GridCoord[] = [{ gx: startGx, gy: startGy }]

    let curGx = startGx
    let curGy = startGy
    let dir = task.dir

    if (depth === 0) {
      occupied.add(coordKey(curGx, curGy))
    }

    for (let seg = 0; seg < maxSegments; seg++) {
      const segLen = 1 + Math.floor(rng() * 3)
      let moved = 0

      for (let step = 0; step < segLen; step++) {
        const nx = curGx + dir[0]
        const ny = curGy + dir[1]
        const nextKey = coordKey(nx, ny)
        if (!isInGap(nx, ny) || occupied.has(nextKey)) {
          break
        }
        occupied.add(nextKey)
        curGx = nx
        curGy = ny
        moved++
      }

      if (moved === 0) {
        break
      }

      gridPoints.push({ gx: curGx, gy: curGy })

      if (moved < segLen || seg + 1 >= maxSegments) {
        break
      }

      const perpA: [number, number] = [-dir[1], dir[0]]
      const perpB: [number, number] = [dir[1], -dir[0]]
      const movingAlongOutwardAxis =
        (dir[0] === outward[0] && dir[1] === outward[1]) ||
        (dir[0] === -outward[0] && dir[1] === -outward[1])

      const nextDir = movingAlongOutwardAxis
        ? rng() < 0.5
          ? perpA
          : perpB
        : outward

      if (depth < opts.maxDepth && rng() < opts.branchProbability) {
        queue.push({
          gx: curGx,
          gy: curGy,
          depth: depth + 1,
          dir: [-nextDir[0], -nextDir[1]],
          outward,
          isInGap,
        })
      }

      dir = nextDir
    }

    if (gridPoints.length < 2) {
      return
    }

    const points = gridPoints.map((pt) => toPixel(pt.gx, pt.gy))
    const end = points[points.length - 1]
    results.push({
      d: buildSvgPathD(points),
      depth,
      points,
      end,
    })
  }

  if (width > height) {
    const inLeftGap = (gx: number, gy: number) => gx < 0 && inFrame(gx, gy)
    const inRightGap = (gx: number, gy: number) => gx > GRID_CELLS && inFrame(gx, gy)

    const leftStarts = pickStartIndices(rng, opts.rootsMin, opts.rootsMax)
    const rightStarts = pickStartIndices(rng, opts.rootsMin, opts.rootsMax)
    const roots: BranchTask[] = [
      ...leftStarts.map((gy) => ({
        gx: 0,
        gy,
        depth: 0,
        dir: [-1, 0] as [number, number],
        outward: [-1, 0] as [number, number],
        isInGap: inLeftGap,
      })),
      ...rightStarts.map((gy) => ({
        gx: GRID_CELLS,
        gy,
        depth: 0,
        dir: [1, 0] as [number, number],
        outward: [1, 0] as [number, number],
        isInGap: inRightGap,
      })),
    ]
    shuffle(roots, rng)
    queue.push(...roots)
  } else {
    const inTopGap = (gx: number, gy: number) => gy < 0 && inFrame(gx, gy)
    const inBottomGap = (gx: number, gy: number) => gy > GRID_CELLS && inFrame(gx, gy)

    const topStarts = pickStartIndices(rng, opts.rootsMin, opts.rootsMax)
    const bottomStarts = pickStartIndices(rng, opts.rootsMin, opts.rootsMax)
    const roots: BranchTask[] = [
      ...topStarts.map((gx) => ({
        gx,
        gy: 0,
        depth: 0,
        dir: [0, -1] as [number, number],
        outward: [0, -1] as [number, number],
        isInGap: inTopGap,
      })),
      ...bottomStarts.map((gx) => ({
        gx,
        gy: GRID_CELLS,
        depth: 0,
        dir: [0, 1] as [number, number],
        outward: [0, 1] as [number, number],
        isInGap: inBottomGap,
      })),
    ]
    shuffle(roots, rng)
    queue.push(...roots)
  }

  for (let i = 0; i < queue.length; i++) {
    walkTask(queue[i])
  }

  return results
}
