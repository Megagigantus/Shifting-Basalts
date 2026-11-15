import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import {
  advanceRing,
  inRing,
  maxWidth,
  nextGrowthRound,
  nextRound,
  pullBackRing,
  ringHazardText,
  ringSettings,
  ringSummary,
  startRing,
  type RingState,
} from './closingRing'
import { enterRoom, ringAdvance, ringNextRound, ringPullBack, ringReset, startFloor } from './roomFlow'
import { clearRoom, newRunState } from './runFlow'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const char = (id: string): Character => ({ ...emptyProfile(), ...emptyDungeonLayer(), id, name: id, level: 5, upgrades: {} })
const start = (pressures: string[]) => startFloor(newRunState('r', 'X', [char('a'), char('b')], pressures), seeded(1))

const ring = ringSettings(['closing-ring'])!
const ring2 = ringSettings(['closing-ring-2'])!

describe('ring settings', () => {
  it('come from the run\'s Pressures, with Closing Ring II growing faster', () => {
    expect(ringSettings([])).toBeNull()
    expect(ringSettings(['narrow-seam'])).toBeNull()
    expect(ring.everyRounds).toBe(3)
    expect(ring2.everyRounds).toBe(2)
  })

  it('never cover the centre 10 ft: a 30 ft room closes in 2 squares, a 70 ft room 6', () => {
    expect(maxWidth(6, ring)).toBe(2)
    expect(maxWidth(10, ring)).toBe(4)
    expect(maxWidth(14, ring)).toBe(6)
  })
})

describe('the ring over a fight', () => {
  it('starts 5 ft deep at round 1, only in fight rooms', () => {
    expect(startRing({ kind: 'combat', size: 'medium', map: null }, ['closing-ring'])).toEqual({ round: 1, width: 1 })
    expect(startRing({ kind: 'reprieve', size: 'medium', map: null }, ['closing-ring'])).toBeNull()
    expect(startRing({ kind: 'combat', size: 'medium', map: null }, [])).toBeNull()
  })

  it('grows on rounds 3, 6 and 9 under Closing Ring', () => {
    let r: RingState = { round: 1, width: 1 }
    const widths: number[] = []
    for (let i = 0; i < 9; i++) {
      r = nextRound(r, ring, 14)
      widths.push(r.width)
    }
    // Rounds 2 to 10.
    expect(widths).toEqual([1, 2, 2, 2, 3, 3, 3, 4, 4])
    expect(nextGrowthRound(1, ring)).toBe(3)
    expect(nextGrowthRound(3, ring)).toBe(6)
  })

  it('grows on rounds 2, 4 and 6 under Closing Ring II', () => {
    let r: RingState = { round: 1, width: 1 }
    for (let i = 0; i < 5; i++) r = nextRound(r, ring2, 14)
    expect(r).toEqual({ round: 6, width: 4 })
  })

  it('stops at the safe centre', () => {
    let r: RingState = { round: 1, width: 1 }
    for (let i = 0; i < 20; i++) r = nextRound(r, ring2, 6)
    expect(r.width).toBe(2)
    expect(advanceRing(r, ring, 6).width).toBe(2)
    expect(ringSummary(r, ring, 6)).toContain('can\'t close in any further')
  })

  it('can be advanced or pulled back by hand, never below 0', () => {
    const r = { round: 2, width: 1 }
    expect(advanceRing(r, ring, 14)).toEqual({ round: 2, width: 2 })
    expect(pullBackRing(pullBackRing(r, ring), ring)).toEqual({ round: 2, width: 0 })
  })

  it('marks the outer squares as in the ring', () => {
    expect(inRing(0, 5, 10, 1)).toBe(true)
    expect(inRing(9, 5, 10, 1)).toBe(true)
    expect(inRing(1, 5, 10, 1)).toBe(false)
    expect(inRing(1, 5, 10, 2)).toBe(true)
    expect(inRing(3, 3, 10, 0)).toBe(false)
  })

  it('says what it does, with the floor\'s trick damage', () => {
    expect(ringHazardText(ring, 1, 5)).toBe('A creature that enters the ring or starts its turn there takes 3d6 force damage.')
    expect(ringSummary({ round: 4, width: 2 }, ring, 14)).toBe(
      'The outer 10 ft is hazardous terrain (round 4). It grows at the start of round 6.',
    )
  })
})

describe('the ring in a run', () => {
  it('a fight room starts its ring, and players see it', () => {
    const state = start(['closing-ring'])
    expect(state.dm?.room?.ring).toEqual({ round: 1, width: 1 })
    expect(state.run.roomView?.ring).toEqual({ round: 1, width: 1 })
  })

  it('no Closing Ring, no ring', () => {
    const state = start([])
    expect(state.dm?.room?.ring).toBeNull()
    expect(state.run.roomView?.ring).toBeNull()
    expect(() => ringNextRound(state)).toThrow()
  })

  it('the DM moves rounds and the ring, and the player view follows', () => {
    let state = start(['closing-ring'])
    state = ringNextRound(ringNextRound(state))
    expect(state.run.roomView?.ring).toEqual({ round: 3, width: 2 })
    state = ringAdvance(state)
    expect(state.dm?.room?.ring).toEqual({ round: 3, width: 3 })
    state = ringPullBack(state)
    expect(state.run.roomView?.ring).toEqual({ round: 3, width: 2 })
    state = ringReset(state)
    expect(state.dm?.room?.ring).toEqual({ round: 1, width: 1 })
  })

  it('each new room starts the ring over', () => {
    let state = ringNextRound(ringNextRound(start(['closing-ring-2'])))
    expect(state.dm?.room?.ring?.round).toBe(3)
    state = enterRoom(clearRoom(state, 'combat'), seeded(2))
    const kind = state.dm?.room?.kind
    expect(state.dm?.room?.ring).toEqual(kind === 'reprieve' ? null : { round: 1, width: 1 })
  })
})
