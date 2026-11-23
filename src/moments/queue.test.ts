import { describe, expect, it } from 'vitest'
import {
  arrivalsFromChanges,
  EMPTY_QUEUE,
  inAudience,
  isFresh,
  reduceQueue,
  type QueueState,
} from './queue'
import { THEME } from './theme'
import type { Moment } from './types'

const NOW = 100_000

function makeMoment(id: string, overrides: Partial<Moment> = {}): Moment {
  return {
    id,
    type: 'boonReveal',
    payload: { card: 'hardy' },
    audience: { players: 'all', table: true },
    createdAtMs: NOW,
    createdBy: 'dm-1',
    status: 'playing',
    ...overrides,
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
  }
  return value
}

describe('isFresh', () => {
  it('treats null createdAtMs as fresh', () => {
    expect(isFresh(null, NOW)).toBe(true)
  })

  it('treats moments within maxMomentAgeMs as fresh and moments older as stale', () => {
    const maxAge = THEME.playback.maxMomentAgeMs
    expect(isFresh(NOW, NOW)).toBe(true)
    expect(isFresh(NOW - maxAge, NOW)).toBe(true)
    expect(isFresh(NOW - (maxAge + 1), NOW)).toBe(false)
    expect(isFresh(NOW - 8001, NOW)).toBe(false)
  })

  it('treats small future clock skew as fresh', () => {
    expect(isFresh(NOW + 500, NOW)).toBe(true)
  })
})

describe('inAudience', () => {
  it('always returns true for dm regardless of flags', () => {
    const hidden = makeMoment('m1', { audience: { players: 'none', table: false } })
    expect(inAudience(hidden, { kind: 'dm' })).toBe(true)
  })

  it('checks audience.table for table viewer', () => {
    expect(inAudience(makeMoment('m1', { audience: { players: 'none', table: true } }), { kind: 'table' })).toBe(true)
    expect(inAudience(makeMoment('m2', { audience: { players: 'all', table: false } }), { kind: 'table' })).toBe(false)
  })

  it('handles all, none, matching, and non-matching ids for player viewer', () => {
    const allMoment = makeMoment('m-all', { audience: { players: 'all', table: false } })
    const noneMoment = makeMoment('m-none', { audience: { players: 'none', table: true } })
    const targetedMoment = makeMoment('m-target', { audience: { players: ['char-a', 'char-b'], table: false } })

    expect(inAudience(allMoment, { kind: 'player', characterIds: [] })).toBe(true)
    expect(inAudience(noneMoment, { kind: 'player', characterIds: ['char-a'] })).toBe(false)
    expect(inAudience(targetedMoment, { kind: 'player', characterIds: ['char-b', 'char-c'] })).toBe(true)
    expect(inAudience(targetedMoment, { kind: 'player', characterIds: ['char-c'] })).toBe(false)
    expect(inAudience(targetedMoment, { kind: 'player', characterIds: [] })).toBe(false)
  })
})

describe('reduceQueue', () => {
  it('plays immediately when idle', () => {
    const m1 = makeMoment('m1')
    const state = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: m1, nowMs: NOW })
    expect(state.current).toEqual({ moment: m1, skipped: false })
    expect(state.waiting).toEqual([])
    expect(state.seen).toEqual(['m1'])
  })

  it('queues arriving moments and plays 3 back-to-back moments in arrival order', () => {
    const m1 = makeMoment('m1')
    const m2 = makeMoment('m2')
    const m3 = makeMoment('m3')

    let state = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: m1, nowMs: NOW })
    state = reduceQueue(state, { type: 'arrive', moment: m2, nowMs: NOW })
    state = reduceQueue(state, { type: 'arrive', moment: m3, nowMs: NOW })

    expect(state.current).toEqual({ moment: m1, skipped: false })
    expect(state.waiting).toEqual([m2, m3])

    state = reduceQueue(state, { type: 'finish', id: 'm1' })
    expect(state.current).toEqual({ moment: m2, skipped: false })
    expect(state.waiting).toEqual([m3])

    state = reduceQueue(state, { type: 'finish', id: 'm2' })
    expect(state.current).toEqual({ moment: m3, skipped: false })
    expect(state.waiting).toEqual([])

    state = reduceQueue(state, { type: 'finish', id: 'm3' })
    expect(state.current).toBeNull()
    expect(state.waiting).toEqual([])
  })

  it('ignores duplicate arrivals', () => {
    const m1 = makeMoment('m1')
    const s1 = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: m1, nowMs: NOW })
    const s2 = reduceQueue(s1, { type: 'arrive', moment: m1, nowMs: NOW })
    expect(s2).toEqual(s1)

    const s3 = reduceQueue(s1, { type: 'finish', id: 'm1' })
    const s4 = reduceQueue(s3, { type: 'arrive', moment: m1, nowMs: NOW })
    expect(s4.current).toBeNull()
    expect(s4.seen).toEqual(['m1'])
  })

  it('ignores stale arrivals', () => {
    const stale = makeMoment('stale', { createdAtMs: NOW - (THEME.playback.maxMomentAgeMs + 1) })
    const state = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: stale, nowMs: NOW })
    expect(state.current).toBeNull()
    expect(state.waiting).toEqual([])
    expect(state.seen).toEqual([])
  })

  it('ignores arrivals whose status is skipped or done', () => {
    const skipped = makeMoment('m-skip', { status: 'skipped' })
    const done = makeMoment('m-done', { status: 'done' })

    const s1 = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: skipped, nowMs: NOW })
    const s2 = reduceQueue(s1, { type: 'arrive', moment: done, nowMs: NOW })
    expect(s2.current).toBeNull()
    expect(s2.waiting).toEqual([])
    expect(s2.seen).toEqual([])
  })

  it('marks current moment skipped on skip status and advances on finish', () => {
    const m1 = makeMoment('m1')
    const m2 = makeMoment('m2')

    let state = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: m1, nowMs: NOW })
    state = reduceQueue(state, { type: 'arrive', moment: m2, nowMs: NOW })

    state = reduceQueue(state, { type: 'status', id: 'm1', status: 'playing' })
    expect(state.current?.skipped).toBe(false)

    state = reduceQueue(state, { type: 'status', id: 'm1', status: 'skipped' })
    expect(state.current).toEqual({ moment: m1, skipped: true })
    expect(state.waiting).toEqual([m2])

    state = reduceQueue(state, { type: 'finish', id: 'm1' })
    expect(state.current).toEqual({ moment: m2, skipped: false })
    expect(state.waiting).toEqual([])
  })

  it('removes a waiting moment when skipped or done', () => {
    const m1 = makeMoment('m1')
    const m2 = makeMoment('m2')
    const m3 = makeMoment('m3')

    let state = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: m1, nowMs: NOW })
    state = reduceQueue(state, { type: 'arrive', moment: m2, nowMs: NOW })
    state = reduceQueue(state, { type: 'arrive', moment: m3, nowMs: NOW })

    state = reduceQueue(state, { type: 'status', id: 'm2', status: 'skipped' })
    expect(state.current).toEqual({ moment: m1, skipped: false })
    expect(state.waiting).toEqual([m3])

    state = reduceQueue(state, { type: 'status', id: 'm3', status: 'done' })
    expect(state.waiting).toEqual([])
  })

  it('does nothing when finish is called with a wrong id', () => {
    const m1 = makeMoment('m1')
    const m2 = makeMoment('m2')

    let state = reduceQueue(EMPTY_QUEUE, { type: 'arrive', moment: m1, nowMs: NOW })
    state = reduceQueue(state, { type: 'arrive', moment: m2, nowMs: NOW })

    const unchanged = reduceQueue(state, { type: 'finish', id: 'wrong-id' })
    expect(unchanged).toEqual(state)

    const emptyUnchanged = reduceQueue(EMPTY_QUEUE, { type: 'finish', id: 'm1' })
    expect(emptyUnchanged).toEqual(EMPTY_QUEUE)
  })

  it('does not mutate its input state', () => {
    const m1 = makeMoment('m1')
    const m2 = makeMoment('m2')
    const m3 = makeMoment('m3')
    const initial: QueueState = deepFreeze({
      current: { moment: m1, skipped: false },
      waiting: [m2],
      seen: ['m1', 'm2'],
    })

    const afterArrive = reduceQueue(initial, { type: 'arrive', moment: m3, nowMs: NOW })
    expect(afterArrive).not.toBe(initial)
    expect(afterArrive.waiting).toEqual([m2, m3])

    const frozenArrive = deepFreeze(afterArrive)
    const afterSkipCurrent = reduceQueue(frozenArrive, { type: 'status', id: 'm1', status: 'skipped' })
    expect(afterSkipCurrent.current?.skipped).toBe(true)

    const afterSkipWaiting = reduceQueue(frozenArrive, { type: 'status', id: 'm2', status: 'skipped' })
    expect(afterSkipWaiting.waiting).toEqual([m3])

    const afterFinish = reduceQueue(frozenArrive, { type: 'finish', id: 'm1' })
    expect(afterFinish.current?.moment).toEqual(m2)
    expect(afterFinish.waiting).toEqual([m3])
  })

  it('keeps seen bounded to at most 100 ids', () => {
    let state = EMPTY_QUEUE
    for (let i = 0; i < 120; i++) {
      state = reduceQueue(state, { type: 'arrive', moment: makeMoment(`m-${i}`), nowMs: NOW })
    }
    expect(state.seen).toHaveLength(100)
    expect(state.seen[0]).toBe('m-20')
    expect(state.seen[99]).toBe('m-119')
  })
})

describe('arrivalsFromChanges', () => {
  it('returns [] on the first snapshot even when added docs are present', () => {
    const changes = [
      { type: 'added' as const, moment: makeMoment('m1') },
      { type: 'modified' as const, moment: makeMoment('m2', { status: 'skipped' }) },
      { type: 'removed' as const, moment: makeMoment('m3') },
    ]
    expect(arrivalsFromChanges(changes, true, NOW)).toEqual([])
  })

  it('maps added and modified changes in order and drops removed', () => {
    const m1 = makeMoment('m1')
    const m2 = makeMoment('m2', { status: 'skipped' })
    const m3 = makeMoment('m3')
    const m4 = makeMoment('m4', { status: 'done' })
    const changes = [
      { type: 'added' as const, moment: m1 },
      { type: 'removed' as const, moment: m3 },
      { type: 'modified' as const, moment: m2 },
      { type: 'added' as const, moment: m4 },
    ]
    expect(arrivalsFromChanges(changes, false, NOW)).toEqual([
      { type: 'arrive', moment: m1, nowMs: NOW },
      { type: 'status', id: 'm2', status: 'skipped' },
      { type: 'arrive', moment: m4, nowMs: NOW },
    ])
  })
})
