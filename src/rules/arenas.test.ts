import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { newRunState, clearRoom } from './runFlow'
import { changeHp, dropMapObject, enterRoom, removeMapObject, rerollBoss, setBossBloodied, startFloor, swapBossForm } from './roomFlow'
import { arenaHasPhase2, arenaOf, currentForm, dims, doorSquares, mapPhase, placeArena, startSquares } from './battleMap'
import { BOSSES } from './bosses'
import { hpTrackers } from './hp'
import type { Room } from './rooms'

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

const char = (id: string): Character => ({ ...emptyProfile(), ...emptyDungeonLayer(), id, name: id, level: 8 })
const ctx = (s: RunState) => ({ partyLevel: s.run.partyLevel, pressures: s.run.pressures })

/** A run standing in floor 1's boss room, with the given boss. */
function inBossRoom(bossId?: string): RunState {
  let state = startFloor(newRunState('r', 'X', [char('a'), char('b'), char('c'), char('d')], []), seeded(3))
  for (let i = 0; i < 4; i++) state = enterRoom(clearRoom(state, 'combat'), seeded(10 + i))
  if (bossId) {
    const room = state.dm!.room!
    const swapped: Room = { ...room, boss: { id: bossId, partySize: 4 }, shifts: [{ bossId, revealed: false }] }
    state = { ...state, dm: { ...state.dm!, bossId, room: { ...swapped, map: placeArena(swapped) } } }
    state = setBossBloodied(state, null) // refresh the player view through the room flow
  }
  return state
}

describe('boss arenas', () => {
  it('every boss has an arena that fits the grid, with tokens for every part', () => {
    for (const b of BOSSES) {
      const room = { kind: 'boss', boss: { id: b.id, partySize: 4 } } as Room
      const map = placeArena(room)!
      expect(map.arena).toBe(b.id)
      expect(map.squares).toBe(14)
      expect(map.door).toBeTruthy()
      for (const p of map.pieces) {
        const { w, h } = dims(p)
        expect(p.x + w).toBeLessThanOrEqual(14)
        expect(p.y + h).toBeLessThanOrEqual(14)
      }
      const tokens = map.pieces.filter((p) => p.kind === 'boss')
      expect(tokens.length).toBe(arenaOf(b.id)!.tokens.length)
      const partCount = (b.parts ?? []).reduce((s, p) => s + p.count, 0)
      if (b.id !== 'kaelen-and-vyr') expect(tokens.length).toBe(Math.max(1, partCount))
      for (const t of tokens) expect(t.hp).toBeTruthy()
    }
  })

  it('a boss room gets its arena during a run, and players see the boss, objects and areas', () => {
    const state = inBossRoom()
    const room = state.dm!.room!
    expect(room.kind).toBe('boss')
    expect(room.map?.arena).toBe(room.boss!.id)
    const seen = state.run.roomView!.map!
    expect(seen.arena).toBe(room.boss!.id)
    expect(seen.pieces.filter((p) => p.kind === 'boss').length).toBe(room.map!.pieces.filter((p) => p.kind === 'boss').length)
    expect(seen.door).toEqual(room.map!.door)
  })

  it('part tokens follow their own HP; a whole-boss token follows the boss\'s Bloodied state', () => {
    let state = inBossRoom('choir-hollow-column')
    const parts = hpTrackers(state.dm!.room!, ctx(state))
    state = changeHp(state, parts[0].key, Math.ceil(parts[0].max / 2))
    const pieces = state.run.roomView!.map!.pieces
    expect(pieces.find((p) => p.hp === parts[0].key)!.state).toBe('bloodied')
    expect(pieces.find((p) => p.hp === parts[1].key)!.state).toBeNull()

    let warden = inBossRoom('tessellated-warden')
    expect(warden.run.roomView!.map!.pieces.find((p) => p.kind === 'boss')!.state).toBeNull()
    warden = setBossBloodied(warden, true)
    expect(warden.run.roomView!.map!.pieces.find((p) => p.kind === 'boss')!.state).toBe('bloodied')
  })

  it('only the Husk and the Gatewright change arena at Bloodied; the Gatewright\'s portals appear then', () => {
    expect(arenaHasPhase2('sun-eaters-husk')).toBe(true)
    expect(arenaHasPhase2('gatewright')).toBe(true)
    expect(arenaHasPhase2('tessellated-warden')).toBe(false)
    expect(arenaHasPhase2('ophaniel')).toBe(false)
    const map = placeArena({ kind: 'boss', boss: { id: 'gatewright', partySize: 4 } } as Room)!
    expect(mapPhase(map, false)).toBe(1)
    expect(mapPhase(map, true)).toBe(2)
    expect(map.areas!.filter((a) => a.phase === 2).map((a) => a.name)).toEqual(['Gilded portal', 'Archive portal', 'Void portal'])
    expect(map.pieces.find((p) => p.name === 'Gate core')!.phase).toBe(1)
  })

  it('Kaelen and Vyr swap forms; other bosses have none', () => {
    let state = inBossRoom('kaelen-and-vyr')
    expect(currentForm(state.dm!.room!.map)).toBe('kaelen')
    state = swapBossForm(state)
    expect(currentForm(state.dm!.room!.map)).toBe('vyr')
    expect(state.run.roomView!.map!.pieces.find((p) => p.kind === 'boss')!.id).toBe('boss-parts:kaelen-and-vyr-vyr')
    expect(currentForm(swapBossForm(state).dm!.room!.map)).toBe('kaelen')
    expect(() => swapBossForm(inBossRoom('tessellated-warden'))).toThrow()
  })

  it('the DM can drop objects from the palette and remove objects, but not boss tokens', () => {
    let state = inBossRoom('tessellated-warden')
    state = dropMapObject(state, 'pillar')
    state = dropMapObject(state, 'pit')
    const drops = state.dm!.room!.map!.pieces.filter((p) => p.key.startsWith('drop:'))
    expect(drops.map((p) => [p.key, p.id, p.w, p.h])).toEqual([
      ['drop:1', 'pillar', 1, 1],
      ['drop:2', 'pit', 2, 2],
    ])
    expect(state.run.roomView!.map!.pieces.some((p) => p.key === 'drop:2')).toBe(true)
    state = removeMapObject(state, 'drop:1')
    expect(state.dm!.room!.map!.pieces.some((p) => p.key === 'drop:1')).toBe(false)
    expect(() => removeMapObject(state, 'boss:0')).toThrow()
    expect(() => dropMapObject(state, 'not-an-object')).toThrow()
  })

  it('rerolling the boss swaps in the new boss\'s arena', () => {
    const state = inBossRoom()
    const next = rerollBoss(state, seeded(99))
    expect(next.dm!.room!.map!.arena).toBe(next.dm!.bossId)
    expect(next.dm!.room!.map!.arena).not.toBe(state.dm!.room!.map!.arena)
  })

  it('the party starts on the arena\'s own entrance (the Chorus enters a row up)', () => {
    const map = placeArena({ kind: 'boss', boss: { id: 'chorus-unseen-angles', partySize: 4 } } as Room)!
    expect(doorSquares(map)).toEqual([
      { x: 6, y: 12 },
      { x: 7, y: 12 },
    ])
    expect(startSquares(map, 2)).toEqual([
      { x: 6, y: 12 },
      { x: 7, y: 12 },
    ])
  })
})
