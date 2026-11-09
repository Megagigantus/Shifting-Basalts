import { describe, expect, it } from 'vitest'
import {
  CONDITIONS,
  generateRoom,
  planFloor,
  playerView,
  terrainOf,
  trickCount,
  trickNumbers,
  trickOf,
  trueExitDC,
  type Room,
} from './rooms'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** Generate many rooms with a seeded random. */
function many(n: number, floor: number, kind: Room['kind'] = 'combat', seed = 1): Room[] {
  const random = seeded(seed)
  return Array.from({ length: n }, (_, i) => generateRoom(floor, (i % 4) + 1, kind, random))
}

describe('floor plans', () => {
  it('never makes floor 1 room 1 elite, and caps elites at 2 per floor', () => {
    const random = seeded(3)
    for (let i = 0; i < 500; i++) {
      const plan = planFloor(1 + (i % 4), 4, [], random)
      expect(plan).toHaveLength(4)
      expect(plan.filter((k) => k === 'elite').length).toBeLessThanOrEqual(2)
      if (i % 4 === 0) expect(plan[0]).toBe('combat')
    }
  })

  it('elites come up roughly 1 room in 4', () => {
    const random = seeded(5)
    let elites = 0
    for (let i = 0; i < 1000; i++) elites += planFloor(2, 4, [], random).filter((k) => k === 'elite').length
    expect(elites / 4000).toBeGreaterThan(0.17)
    expect(elites / 4000).toBeLessThan(0.27)
  })

  it('places at most one Reprieve, at room 2 or 3, more often with more owners', () => {
    const random = seeded(7)
    let one = 0
    let two = 0
    for (let i = 0; i < 1000; i++) {
      const single = planFloor(2, 4, [1], random)
      const pair = planFloor(2, 4, [4, 4], random)
      for (const plan of [single, pair]) {
        expect(plan.filter((k) => k === 'reprieve').length).toBeLessThanOrEqual(1)
        expect([plan[0], plan[3]]).not.toContain('reprieve')
      }
      if (single.includes('reprieve')) one++
      if (pair.includes('reprieve')) two++
    }
    expect(one / 1000).toBeGreaterThan(0.12) // rank 1: 20%
    expect(one / 1000).toBeLessThan(0.28)
    expect(two / 1000).toBeGreaterThan(0.8) // two rank-4 owners: 1 - 0.35^2 ≈ 88%
    expect(planFloor(2, 4, [], seeded(1))).not.toContain('reprieve')
  })
})

describe('rooms', () => {
  it('respect floor limits on shapes and terrain', () => {
    for (const room of many(400, 1)) {
      expect(room.shape).not.toBe('twisted-vault')
      expect(room.terrain).not.toContain('pool-of-raw-stride-energy')
      expect(room.terrain).not.toContain('inverted-overgrowth')
      expect(room.terrain).not.toContain('roll-twice')
    }
    const floor3 = many(400, 3)
    expect(floor3.some((r) => r.shape === 'twisted-vault')).toBe(true)
    expect(floor3.flatMap((r) => r.terrain)).not.toContain('inverted-overgrowth')
    expect(many(600, 4).flatMap((r) => r.terrain)).toContain('inverted-overgrowth')
  })

  it('have 2 or more terrain features, 1 to 3 exits with a true one, and 2 flavor lines', () => {
    for (const room of many(300, 2)) {
      expect(room.terrain.length).toBeGreaterThanOrEqual(1)
      expect(room.terrain.length).toBeLessThanOrEqual(6)
      expect(room.exits).toBeGreaterThanOrEqual(1)
      expect(room.exits).toBeLessThanOrEqual(3)
      expect(room.trueExit).toBeGreaterThanOrEqual(1)
      expect(room.trueExit).toBeLessThanOrEqual(room.exits)
      expect(new Set(room.flavor).size).toBe(2)
      for (const id of room.terrain) expect(terrainOf(id)).toBeTruthy()
    }
  })

  it('have an oddity about 1 room in 6', () => {
    const rooms = many(1200, 2)
    const share = rooms.filter((r) => r.oddity !== null).length / rooms.length
    expect(share).toBeGreaterThan(0.11)
    expect(share).toBeLessThan(0.23)
  })

  it('boss rooms are always large with no tricks or condition; Reprieves have no tricks or condition', () => {
    for (const boss of many(50, 3, 'boss')) {
      expect(boss.size).toBe('large')
      expect(boss.tricks).toEqual([])
      expect(boss.condition).toBeNull()
    }
    for (const reprieve of many(50, 2, 'reprieve')) {
      expect(reprieve.tricks).toEqual([])
      expect(reprieve.condition).toBeNull()
    }
    for (const room of many(50, 2)) expect(CONDITIONS.some((c) => c.roll === room.condition)).toBe(true)
  })
})

describe('tricks', () => {
  it('follow the frequency table, with +1 in elite rooms', () => {
    const counts = (floor: number, kind: Room['kind']) => {
      const random = seeded(floor * 11)
      return new Set(Array.from({ length: 300 }, () => trickCount(floor, kind, random)))
    }
    expect([...counts(1, 'combat')].sort()).toEqual([0, 1])
    expect([...counts(2, 'combat')].sort()).toEqual([1, 2])
    expect([...counts(4, 'combat')].sort()).toEqual([2, 3])
    expect([...counts(4, 'elite')].sort()).toEqual([3, 4])
  })

  it('draw from the current floor, sometimes an earlier one, never a deeper one', () => {
    const tricks = many(500, 2).flatMap((r) => r.tricks.map((t) => trickOf(t.id)))
    expect(tricks.every((t) => t.floor <= 2)).toBe(true)
    expect(tricks.some((t) => t.floor === 1)).toBe(true)
    expect(tricks.filter((t) => t.floor === 2).length).toBeGreaterThan(tricks.filter((t) => t.floor === 1).length)
    for (const room of many(200, 1)) expect(room.tricks.every((t) => trickOf(t.id).floor === 1)).toBe(true)
  })

  it('never repeat a trick in one room', () => {
    for (const room of many(300, 4, 'elite')) expect(new Set(room.tricks.map((t) => t.id)).size).toBe(room.tricks.length)
  })

  it('use DC 10 + PB + floor and PB d6 (floors 1-2) or PB d8 (floors 3-4)', () => {
    expect(trickNumbers(1, 5)).toEqual({ dc: 14, damage: '3d6' })
    expect(trickNumbers(3, 12)).toEqual({ dc: 17, damage: '4d8' })
    expect(trueExitDC(2)).toBe(12)
  })
})

describe('player view', () => {
  const room: Room = {
    floor: 2,
    room: 1,
    kind: 'combat',
    shape: 'ring',
    size: 'medium',
    elevation: 2,
    lighting: 'flickering',
    exits: 3,
    trueExit: 2,
    terrain: ['low-columns', 'false-wall'],
    flavor: [0, 3],
    oddity: 4,
    tricks: [
      { id: 'static-vent', revealed: false },
      { id: 'magnetic-floor', revealed: true },
    ],
    condition: 7,
    revealed: { trueExit: false, falseWall: false, oddity: false, condition: false },
  }

  it('hides the true exit, false wall, oddity, unsprung tricks and the condition', () => {
    const view = playerView(room)
    expect(view.terrain).toEqual(['low-columns'])
    expect(view.trueExit).toBeNull()
    expect(view.oddity).toBeNull()
    expect(view.tricks).toEqual(['magnetic-floor'])
    expect(view.condition).toBeNull()
    expect(view.exits).toBe(3)
    expect(view.flavor).toEqual([0, 3])
  })

  it('shows each one once revealed', () => {
    const view = playerView({ ...room, revealed: { trueExit: true, falseWall: true, oddity: true, condition: true } })
    expect(view.terrain).toEqual(['low-columns', 'false-wall'])
    expect(view.trueExit).toBe(2)
    expect(view.oddity).toBe(4)
    expect(view.condition).toBe(7)
  })
})
