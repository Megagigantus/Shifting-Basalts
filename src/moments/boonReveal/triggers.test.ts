import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../../model/character'
import type { RunState } from '../../model/run'
import { hiddenBoon, takeBoon } from '../../rules/boons'
import {
  banishOffer,
  classTriggerMet,
  openDrafts,
  openStartingBoons,
  rerollDraft,
  roomConditionMet,
} from '../../rules/draftFlow'
import { spendForge } from '../../rules/forge'
import { conditionOf, generateRoom } from '../../rules/rooms'
import { changeSlots, clearRoom, defeatBoss, newRunState } from '../../rules/runFlow'
import { cardFromOffer } from '../revealTier'
import { revealsFromChange } from './triggers'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const character = (id: string, overrides: Partial<Character> = {}): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  ...overrides,
})

function start(chars = [
  character('a', { name: 'Aria' }),
  character('b', { name: 'Bram', classId: 'wizard', casterType: 'full' }),
]): RunState {
  return newRunState('run-1', 'ABCD', chars, [])
}

function toBoss(state: RunState): RunState {
  let current = state
  for (let i = 0; i < 4; i++) current = clearRoom(current, 'combat')
  return defeatBoss(current)
}

function withBoons(state: RunState, id: string, boons: string[]): RunState {
  return changeSlots(state, id, (s) => boons.reduce((acc, b) => takeBoon(acc, b), s))
}

function findUndefinedPaths(value: unknown, path = 'root'): string[] {
  if (value === undefined) return [path]
  if (value === null || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findUndefinedPaths(item, `${path}[${index}]`))
  }
  return Object.entries(value).flatMap(([key, entry]) =>
    findUndefinedPaths(entry, `${path}.${key}`),
  )
}

describe('revealsFromChange', () => {
  it('returns an empty list when prev is null', () => {
    const next = openDrafts(clearRoom(start(), 'combat'), 'combat', seeded(1))
    expect(revealsFromChange(null, next)).toEqual([])
  })

  it('emits one draft moment for all players whose room-clear drafts just opened', () => {
    const prev = clearRoom(start(), 'combat')
    const next = openDrafts(prev, 'combat', seeded(1))

    const moments = revealsFromChange(prev, next)
    expect(moments).toHaveLength(1)
    expect(findUndefinedPaths(moments)).toEqual([])

    const moment = moments[0]!
    expect(moment.type).toBe('boonReveal')
    expect(moment.audience).toEqual({ players: ['a', 'b'], table: true })
    expect(moment.payload).toEqual({
      kind: 'draft',
      offers: {
        a: next.players[0]!.draft!.offers.map((o) => cardFromOffer(o, next.players[0]!.slots ?? [])),
        b: next.players[1]!.draft!.offers.map((o) => cardFromOffer(o, next.players[1]!.slots ?? [])),
      },
      names: { a: 'Aria', b: 'Bram' },
      conditionText: null,
      partyWide: false,
    })
  })

  it('emits no moment for starting drafts, rerolls, or banishes', () => {
    const chars = [
      character('a', { name: 'Aria', upgrades: { 'starting-boon': 1, reroll: 1, banish: 1 } }),
      character('b', { name: 'Bram' }),
    ]
    const base = start(chars)

    const starting = openStartingBoons(base, ['a'], seeded(3))
    expect(revealsFromChange(base, starting)).toEqual([])

    const drafted = openDrafts(clearRoom(base, 'combat'), 'combat', seeded(1))
    const rerolled = rerollDraft(drafted, 'a', seeded(2))
    expect(rerolled.players[0]!.draft!.offers).not.toEqual(drafted.players[0]!.draft!.offers)
    expect(revealsFromChange(drafted, rerolled)).toEqual([])

    const idx = drafted.players[0]!.draft!.offers.findIndex((o) => o.kind === 'boon' && o.source === 'weighted')
    expect(idx).toBeGreaterThanOrEqual(0)
    const banished = banishOffer(drafted, 'a', idx, undefined, seeded(4))
    expect(revealsFromChange(drafted, banished)).toEqual([])
  })

  it('emits a party-wide hidden moment with condition text and thils accent when room condition is met', () => {
    const room = { ...generateRoom(1, 1, 'combat', seeded(1)), condition: 2 }
    const prev: RunState = {
      ...start(),
      dm: { floorPlan: ['combat', 'combat', 'combat', 'combat'], room },
    }
    const next = roomConditionMet(prev, seeded(5))
    const expectedCondition = conditionOf(2).condition

    const moments = revealsFromChange(prev, next)
    expect(moments).toHaveLength(1)
    expect(findUndefinedPaths(moments)).toEqual([])

    const moment = moments[0]!
    expect(moment.type).toBe('boonReveal')
    expect(moment.audience).toEqual({ players: ['a', 'b'], table: true })
    expect(moment.payload.kind).toBe('hidden')
    expect(moment.payload.partyWide).toBe(true)
    expect(moment.payload.conditionText).toBe(expectedCondition)
    expect(moment.payload.names).toEqual({ a: 'Aria', b: 'Bram' })

    for (const id of ['a', 'b']) {
      const cards = moment.payload.offers[id]!
      expect(cards).toHaveLength(2)
      for (const card of cards) {
        expect(card.tier).toBe('hidden')
        expect(card.accent).toBe('thils')
        expect(card.conditionText).toBe(expectedCondition)
      }
    }
  })

  it('emits a non-party-wide hidden moment for a class trigger and skips already-offered class boons', () => {
    const prev = start()
    const next = classTriggerMet(prev, 'b')

    const moments = revealsFromChange(prev, next)
    expect(moments).toHaveLength(1)
    expect(findUndefinedPaths(moments)).toEqual([])

    const moment = moments[0]!
    expect(moment.type).toBe('boonReveal')
    expect(moment.audience).toEqual({ players: ['b'], table: true })
    expect(moment.payload.kind).toBe('hidden')
    expect(moment.payload.partyWide).toBe(false)
    expect(moment.payload.conditionText).toBeNull()
    expect(moment.payload.offers.a).toBeUndefined()
    expect(moment.payload.offers.b).toHaveLength(1)

    const card = moment.payload.offers.b![0]!
    expect(card.id).toBe('the-archivist')
    expect(card.tier).toBe('hidden')
    expect(card.accent).toBeNull()
    expect(card.conditionText).toBe(hiddenBoon('the-archivist').condition)

    // A follow-up save where the class boon was already offered produces no new moment.
    const resaved: RunState = { ...next, players: next.players.map((p) => ({ ...p })) }
    expect(revealsFromChange(next, resaved)).toEqual([])
  })

  it('emits a forge moment for Evolve and Combine, and no moment for Forge level-up', () => {
    const chars = [
      character('a', { name: 'Aria', upgrades: { forge: 1 } }),
      character('b', { name: 'Bram', upgrades: { forge: 1 } }),
    ]
    let atForge = toBoss(start(chars))
    atForge = withBoons(atForge, 'a', ['ulmas-thread', 'ulmas-thread', 'ulmas-thread'])
    atForge = withBoons(atForge, 'b', [
      'critical-delight', 'critical-delight', 'critical-delight',
      'crits-are-for-suckers', 'crits-are-for-suckers', 'crits-are-for-suckers',
    ])

    const afterEvolve = spendForge(atForge, 'a', { kind: 'evolve', slotIndex: 0 })
    const evolveMoments = revealsFromChange(atForge, afterEvolve)
    expect(evolveMoments).toHaveLength(1)
    expect(findUndefinedPaths(evolveMoments)).toEqual([])
    expect(evolveMoments[0]!.audience).toEqual({ players: ['a'], table: true })
    expect(evolveMoments[0]!.payload.kind).toBe('forge')
    expect(evolveMoments[0]!.payload.conditionText).toBeNull()
    expect(evolveMoments[0]!.payload.partyWide).toBe(false)
    expect(evolveMoments[0]!.payload.offers.a).toHaveLength(1)
    expect(evolveMoments[0]!.payload.offers.a![0]).toMatchObject({
      cardKind: 'evolution',
      id: 'ball-of-yarn',
      tier: 'evolved',
    })

    const afterCombine = spendForge(afterEvolve, 'b', { kind: 'combine', combinationId: 'super-normal' })
    const combineMoments = revealsFromChange(afterEvolve, afterCombine)
    expect(combineMoments).toHaveLength(1)
    expect(findUndefinedPaths(combineMoments)).toEqual([])
    expect(combineMoments[0]!.audience).toEqual({ players: ['b'], table: true })
    expect(combineMoments[0]!.payload.kind).toBe('forge')
    expect(combineMoments[0]!.payload.offers.b).toHaveLength(1)
    expect(combineMoments[0]!.payload.offers.b![0]).toMatchObject({
      cardKind: 'combination',
      id: 'super-normal',
      tier: 'fused',
      sources: ['critical-delight', 'crits-are-for-suckers'],
    })

    const levelBase = withBoons(toBoss(start([character('a', { name: 'Aria', upgrades: { forge: 1 } })])), 'a', ['hardy'])
    const afterLevel = spendForge(levelBase, 'a', { kind: 'level', slotIndex: 0 })
    expect(revealsFromChange(levelBase, afterLevel)).toEqual([])
  })

  it('skips a bad moment without throwing when an unknown id is encountered', () => {
    const prev = clearRoom(start(), 'combat')
    const nextWithBadDraft: RunState = {
      ...prev,
      players: prev.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              draft: {
                floor: 1,
                room: 1,
                elite: false,
                offers: [{ kind: 'boon', boonId: 'unknown-boon-id', source: 'weighted' }],
              },
            }
          : p,
      ),
    }

    expect(() => revealsFromChange(prev, nextWithBadDraft)).not.toThrow()
    expect(revealsFromChange(prev, nextWithBadDraft)).toEqual([])

    const nextWithBadDraftAndGoodHidden = classTriggerMet(nextWithBadDraft, 'b')
    const moments = revealsFromChange(prev, nextWithBadDraftAndGoodHidden)
    expect(moments).toHaveLength(1)
    expect(moments[0]!.payload.kind).toBe('hidden')
    expect(findUndefinedPaths(moments)).toEqual([])

    const nextWithBadHidden: RunState = {
      ...prev,
      players: prev.players.map((p, i) =>
        i === 0 ? { ...p, hiddenOffer: { gifts: [], classBoon: 'unknown-hidden-id' } } : p,
      ),
    }
    expect(() => revealsFromChange(prev, nextWithBadHidden)).not.toThrow()
    expect(revealsFromChange(prev, nextWithBadHidden)).toEqual([])
  })
})
