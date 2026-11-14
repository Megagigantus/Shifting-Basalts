import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import { newRunState } from './runFlow'
import { layOutMap, moveMapPiece, rerollEncounter, startFloor } from './roomFlow'
import { entranceSquares, footprint, movePiece, placeMap, type BattleMap } from './battleMap'
import { generateRoom, type Room } from './rooms'
import { generateEncounter } from './encounters'

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const char = (id: string): Character => ({ ...emptyProfile(), ...emptyDungeonLayer(), id, name: id, level: 5 })

/** A generated room with its encounter, ready to lay out. */
function room(seed: number, overrides: Partial<Room> = {}): Room {
  const r = seeded(seed)
  const base = { ...generateRoom(2, 2, 'combat', r), ...overrides }
  return { ...base, encounter: generateEncounter(2, false, [8, 8, 8, 8], 8, r) }
}

const overlaps = (map: BattleMap) => {
  const seen = new Set<string>()
  let clash = 0
  for (const p of map.pieces) {
    const s = footprint(p)
    for (let dy = 0; dy < s; dy++)
      for (let dx = 0; dx < s; dx++) {
        const k = `${p.x + dx},${p.y + dy}`
        if (seen.has(k)) clash++
        seen.add(k)
      }
  }
  return clash
}

describe('laying out a battle map', () => {
  it('sizes the grid by room size and places one piece per doorway, feature, trick and creature', () => {
    for (const [size, n] of [['small', 6], ['medium', 10], ['large', 14]] as const) {
      const r = room(1, { size })
      const map = placeMap(r, seeded(2))!
      expect(map.squares).toBe(n)
      expect(map.pieces.filter((p) => p.kind === 'exit')).toHaveLength(r.exits)
      expect(map.pieces.filter((p) => p.kind === 'terrain').map((p) => p.id)).toEqual(r.terrain)
      expect(map.pieces.filter((p) => p.kind === 'trick').map((p) => p.id)).toEqual(r.tricks.map((t) => t.id))
      expect(map.pieces.filter((p) => p.kind === 'enemy')).toHaveLength(r.encounter!.groups.reduce((s, g) => s + g.count, 0))
    }
  })

  it('keeps every piece on the grid, off the entrance and (in medium and large rooms) off each other', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = room(seed, { size: seed % 2 ? 'medium' : 'large' })
      const map = placeMap(r, seeded(seed + 1000))!
      const door = entranceSquares(map.squares, map.entrance).map((q) => `${q.x},${q.y}`)
      for (const p of map.pieces) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.x + footprint(p)).toBeLessThanOrEqual(map.squares)
        expect(p.y + footprint(p)).toBeLessThanOrEqual(map.squares)
        expect(door).not.toContain(`${p.x},${p.y}`)
      }
      expect(overlaps(map)).toBe(0)
    }
  })

  it('enters from the south, except the split chamber, which enters from the east', () => {
    expect(placeMap(room(3, { shape: 'hex-hall' }), seeded(4))!.entrance).toBe('south')
    expect(placeMap(room(3, { shape: 'split-chamber' }), seeded(4))!.entrance).toBe('east')
  })

  it('puts enemies in the half away from the entrance when there is room', () => {
    const map = placeMap(room(5, { size: 'large', shape: 'hex-hall' }), seeded(6))!
    for (const p of map.pieces.filter((q) => q.kind === 'enemy')) expect(p.y).toBeLessThan(map.squares / 2)
  })

  it('places a trick next to terrain it fits when that terrain is in the room', () => {
    // Static Vent prefers a fissure or a broken column field.
    const r = room(7, { size: 'large', terrain: ['fissure'], tricks: [{ id: 'static-vent', revealed: false }] })
    const map = placeMap(r, seeded(8))!
    const fissure = map.pieces.find((p) => p.id === 'fissure')!
    const vent = map.pieces.find((p) => p.id === 'static-vent')!
    expect(Math.max(Math.abs(vent.x - fissure.x), Math.abs(vent.y - fissure.y))).toBeLessThanOrEqual(2)
  })

  it('sizes creature tokens from their size', () => {
    const r = room(9, { size: 'large' })
    r.encounter = { ...r.encounter!, groups: [{ creatureId: 'corner-bull', cr: 3, count: 1, revealed: false }, { creatureId: 'stride-wisp', cr: 2, count: 2, revealed: false }] }
    const map = placeMap(r, seeded(10))!
    expect(map.pieces.find((p) => p.id === 'corner-bull')!.size).toBe(2)
    expect(map.pieces.find((p) => p.id === 'stride-wisp')!.size).toBe(0.5)
  })

  it('gives the same layout for the same roll, and no map to boss rooms or Reprieves', () => {
    const r = room(11)
    expect(placeMap(r, seeded(12))).toEqual(placeMap(r, seeded(12)))
    expect(placeMap({ ...r, kind: 'boss' }, seeded(12))).toBeNull()
    expect(placeMap({ ...r, kind: 'reprieve' }, seeded(12))).toBeNull()
  })
})

describe('the battle map during a run', () => {
  const start = () => startFloor(newRunState('r', 'X', [char('a'), char('b')], []), seeded(21))

  it('lays out the first room when the floor starts', () => {
    const map = start().dm!.room!.map!
    expect(map.pieces.some((p) => p.kind === 'enemy')).toBe(true)
  })

  it('rerolling the encounter keeps doorways, terrain and tricks where they were', () => {
    const state = start()
    const before = state.dm!.room!.map!.pieces.filter((p) => p.kind !== 'enemy')
    const after = rerollEncounter(state, seeded(22)).dm!.room!.map!.pieces.filter((p) => p.kind !== 'enemy')
    expect(after).toEqual(before)
  })

  it('the DM can drag a piece, kept on the grid, and lay the map out again', () => {
    let state = start()
    const piece = state.dm!.room!.map!.pieces[0]
    state = moveMapPiece(state, piece.key, -5, 999)
    const moved = state.dm!.room!.map!.pieces.find((p) => p.key === piece.key)!
    expect(moved.x).toBe(0)
    expect(moved.y).toBe(state.dm!.room!.map!.squares - footprint(moved))
    expect(() => moveMapPiece(state, 'nope', 1, 1)).toThrow()
    expect(layOutMap(state, seeded(23)).dm!.room!.map).toBeTruthy()
  })

  it('moving a piece to where it already is changes nothing', () => {
    const map = placeMap(room(31), seeded(32))!
    const p = map.pieces[0]
    expect(movePiece(map, p.key, p.x, p.y)).toBe(map)
  })
})
