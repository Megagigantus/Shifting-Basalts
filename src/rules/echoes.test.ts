import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import { BOONS, COMBINATIONS, EVOLUTIONS, HIDDEN_BOONS, emptySlots, replaceBoon, takeBoon, type Slot } from './boons'
import {
  collectionOf,
  echoCounts,
  echoPool,
  echoesOf,
  emptyEchoes,
  hasFullCollection,
  mergeEchoes,
  playerCollection,
  recordEchoes,
  visibleEchoCounts,
  withPlayerCollections,
  type EchoCollection,
  type Echoes,
} from './echoes'
import { changeSlots, newRunState, setHiddenBoon } from './runFlow'

const char = (id: string): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
})

describe('echoesOf', () => {
  it('returns empty groups when nothing is held', () => {
    expect(echoesOf(undefined)).toEqual(emptyEchoes())
    expect(echoesOf(emptySlots(3), null)).toEqual(emptyEchoes())
  })

  it('records a plain boon, an Evolution with its source boon, a Combination with both boons, and a hidden boon', () => {
    const slots: Slot[] = [
      { kind: 'boon', boonId: 'hardy', level: 2 },
      { kind: 'evolution', evolutionId: 'chain-of-echoes' },
      { kind: 'combination', combinationId: 'super-normal' },
    ]
    expect(echoesOf(slots, 'keeper-of-ways')).toEqual({
      boons: ['hardy', 'traverts-echoes', 'critical-delight', 'crits-are-for-suckers'],
      evolutions: ['chain-of-echoes'],
      combinations: ['super-normal'],
      hidden: ['keeper-of-ways'],
    })
  })
})

describe('mergeEchoes', () => {
  it('unions each group in first-seen order without duplicates, and handles undefined or partial records', () => {
    expect(mergeEchoes(undefined, null)).toEqual(emptyEchoes())

    const older = { boons: ['hardy', 'honed'] } as Echoes
    const newer: Echoes = {
      boons: ['honed', 'fleet-foot'],
      evolutions: ['chain-of-echoes'],
      combinations: ['super-normal'],
      hidden: ['keeper-of-ways'],
    }
    expect(mergeEchoes(older, newer)).toEqual({
      boons: ['hardy', 'honed', 'fleet-foot'],
      evolutions: ['chain-of-echoes'],
      combinations: ['super-normal'],
      hidden: ['keeper-of-ways'],
    })
  })
})

describe('recordEchoes', () => {
  it('keeps the same state reference when nothing is new', () => {
    const initial = newRunState('r1', 'ABCD', [char('c0'), char('c1')], [])
    expect(recordEchoes(initial)).toBe(initial)

    const withBoon = recordEchoes(changeSlots(initial, 'c0', (s) => takeBoon(s, 'hardy')))
    expect(withBoon).not.toBe(initial)
    expect(withBoon.players[1]).toBe(initial.players[1])
    expect(recordEchoes(withBoon)).toBe(withBoon)
  })

  it('keeps a boon that is later replaced in a slot', () => {
    let state = newRunState('r1', 'ABCD', [char('c0')], [])
    state = recordEchoes(changeSlots(state, 'c0', (s) => takeBoon(s, 'hardy')))
    state = changeSlots(state, 'c0', (s) => replaceBoon(s, 0, 'night-eyes'))
    state = setHiddenBoon(state, 'c0', 'keeper-of-ways')
    state = recordEchoes(state)

    expect(state.players[0].echoes).toEqual({
      boons: ['hardy', 'night-eyes'],
      evolutions: [],
      combinations: [],
      hidden: ['keeper-of-ways'],
    })
  })
})

describe('echoCounts', () => {
  it('counts each group against the data, with hidden limited to gifts plus own classes', () => {
    const empty = echoCounts({ classId: 'fighter' })
    expect(empty.boons).toEqual({ seen: 0, total: BOONS.length })
    expect(empty.evolutions.total).toBe(EVOLUTIONS.length)
    expect(empty.combinations.total).toBe(COMBINATIONS.length)
    const gifts = HIDDEN_BOONS.filter((h) => h.kind === 'gift').length
    expect(empty.hidden.total).toBe(gifts + 1)
    expect(echoCounts({ classId: 'fighter', secondClassId: 'wizard' }).hidden.total).toBe(gifts + 2)
    expect(echoCounts({ classId: 'homebrew' }).hidden.total).toBe(gifts)
  })

  it('counts seen ids once, ignores ids no longer in the data, and sums overall', () => {
    const c = {
      classId: 'fighter',
      echoes: { boons: [BOONS[0].id, BOONS[1].id, 'retired-boon'], evolutions: [EVOLUTIONS[0].id], combinations: [], hidden: [] },
    }
    const counts = echoCounts(c)
    expect(counts.boons.seen).toBe(2)
    expect(counts.evolutions.seen).toBe(1)
    expect(counts.overall.seen).toBe(3)
    expect(counts.overall.total).toBe(counts.boons.total + counts.evolutions.total + counts.combinations.total + counts.hidden.total)
  })

  it('unions class ids across two characters of a player when counting hidden boons', () => {
    const c1 = { playerEmail: 'alice@example.com', classId: 'fighter' }
    const c2 = { playerEmail: 'alice@example.com', classId: 'wizard', secondClassId: 'cleric' }
    const collection = playerCollection(c1, [c1, c2])
    const expectedHidden = HIDDEN_BOONS.filter(
      (h) => h.kind === 'gift' || h.classId === 'fighter' || h.classId === 'wizard' || h.classId === 'cleric',
    ).length
    expect(echoCounts({ ...c1, collection }).hidden.total).toBe(expectedHidden)
  })
})

describe('visibleEchoCounts', () => {
  it('hides unfound hidden boons when none are seen', () => {
    const trueCounts = echoCounts({ classId: 'fighter' })
    const counts = visibleEchoCounts({ classId: 'fighter' })
    expect(counts.hidden).toEqual({ seen: 0, total: 0 })
    expect(counts.overall.total).toBe(trueCounts.boons.total + trueCounts.evolutions.total + trueCounts.combinations.total)
  })

  it('counts found hidden boons as 1 of 1 and grows overall total by 1', () => {
    const trueCounts = echoCounts({ classId: 'fighter' })
    const pool = echoPool({ classId: 'fighter' })
    const counts = visibleEchoCounts({
      classId: 'fighter',
      echoes: { ...emptyEchoes(), hidden: [pool.hidden[0]] },
    })
    expect(counts.hidden).toEqual({ seen: 1, total: 1 })
    expect(counts.overall.seen).toBe(1)
    expect(counts.overall.total).toBe(trueCounts.boons.total + trueCounts.evolutions.total + trueCounts.combinations.total + 1)
  })

  it('ignores a seen hidden id outside the character pool', () => {
    const trueCounts = echoCounts({ classId: 'fighter' })
    const otherClassHidden = HIDDEN_BOONS.find((h) => h.kind === 'class' && h.classId !== 'fighter')
    expect(otherClassHidden).toBeDefined()
    const counts = visibleEchoCounts({
      classId: 'fighter',
      echoes: { ...emptyEchoes(), hidden: [otherClassHidden!.id] },
    })
    expect(counts.hidden).toEqual({ seen: 0, total: 0 })
    expect(counts.overall.seen).toBe(0)
    expect(counts.overall.total).toBe(trueCounts.boons.total + trueCounts.evolutions.total + trueCounts.combinations.total)
  })

  it('keeps hidden total equal to hidden seen on a player collection', () => {
    const pool = echoPool({ classId: 'fighter', secondClassId: 'wizard' })
    const c1 = {
      playerEmail: 'alice@example.com',
      classId: 'fighter',
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id] },
    }
    const c2 = {
      playerEmail: 'alice@example.com',
      classId: 'wizard',
      echoes: { ...emptyEchoes(), hidden: [pool.hidden[0]] },
    }
    const [withCol1] = withPlayerCollections([c1, c2])
    const counts = visibleEchoCounts(withCol1)
    expect(counts.hidden).toEqual({ seen: 1, total: 1 })
    expect(counts.overall.seen).toBe(2)
    expect(counts.overall.total).toBe(counts.boons.total + counts.evolutions.total + counts.combinations.total + 1)
  })
})

describe('hasFullCollection', () => {
  it('is false when empty or missing a hidden boon, and true when the whole pool is seen', () => {
    expect(hasFullCollection({ classId: 'fighter' })).toBe(false)

    const pool = echoPool({ classId: 'fighter' })
    expect(pool.hidden.length).toBeGreaterThan(0)
    const almostAll: Echoes = { ...pool, hidden: pool.hidden.slice(1) }
    expect(hasFullCollection({ classId: 'fighter', echoes: almostAll })).toBe(false)

    expect(hasFullCollection({ classId: 'fighter', echoes: pool })).toBe(true)
  })

  it('is true for a player whose two characters together hold the union pool, while each alone is false', () => {
    const unionPool = echoPool({ classId: 'fighter', secondClassId: 'wizard' })
    const c1 = {
      playerEmail: 'alice@example.com',
      classId: 'fighter',
      echoes: {
        boons: unionPool.boons,
        evolutions: [],
        combinations: [],
        hidden: unionPool.hidden.slice(0, 1),
      },
    }
    const c2 = {
      playerEmail: 'alice@example.com',
      classId: 'wizard',
      echoes: {
        boons: [],
        evolutions: unionPool.evolutions,
        combinations: unionPool.combinations,
        hidden: unionPool.hidden.slice(1),
      },
    }

    expect(hasFullCollection(c1)).toBe(false)
    expect(hasFullCollection(c2)).toBe(false)

    const [withCol1, withCol2] = withPlayerCollections([c1, c2])
    expect(hasFullCollection(withCol1)).toBe(true)
    expect(hasFullCollection(withCol2)).toBe(true)
  })
})

describe('collectionOf', () => {
  it('falls back to the single character when no collection is attached, and returns collection when present', () => {
    const single = {
      classId: 'fighter',
      secondClassId: '',
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id, BOONS[0].id] },
    }
    expect(collectionOf(single)).toEqual({
      classIds: ['fighter'],
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id] },
    })
    expect(collectionOf({ classId: 'fighter', secondClassId: 'fighter' }).classIds).toEqual(['fighter'])

    const collection: EchoCollection = {
      classIds: ['fighter', 'wizard'],
      echoes: { ...emptyEchoes(), boons: [BOONS[1].id] },
    }
    expect(collectionOf({ ...single, collection })).toBe(collection)
  })
})

describe('playerCollection', () => {
  it('merges echoes from two characters of the same player and ignores other players and unassigned characters', () => {
    const alice1 = {
      playerEmail: 'alice@example.com',
      classId: 'fighter',
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id] },
    }
    const alice2 = {
      playerEmail: 'alice@example.com',
      classId: 'wizard',
      secondClassId: 'cleric',
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id, BOONS[1].id], evolutions: [EVOLUTIONS[0].id] },
    }
    const bob = {
      playerEmail: 'bob@example.com',
      classId: 'rogue',
      echoes: { ...emptyEchoes(), boons: [BOONS[2].id], combinations: [COMBINATIONS[0].id] },
    }
    const unassigned = {
      playerEmail: '',
      classId: 'paladin',
      echoes: { ...emptyEchoes(), boons: [BOONS[3].id] },
    }
    const everyone = [alice1, alice2, bob, unassigned]

    expect(playerCollection(alice1, everyone)).toEqual({
      classIds: ['fighter', 'wizard', 'cleric'],
      echoes: {
        boons: [BOONS[0].id, BOONS[1].id],
        evolutions: [EVOLUTIONS[0].id],
        combinations: [],
        hidden: [],
      },
    })
    expect(playerCollection(alice1, [alice2, bob, unassigned])).toEqual({
      classIds: ['wizard', 'cleric', 'fighter'],
      echoes: {
        boons: [BOONS[0].id, BOONS[1].id],
        evolutions: [EVOLUTIONS[0].id],
        combinations: [],
        hidden: [],
      },
    })
  })

  it('returns only the character own echoes and classes when unassigned', () => {
    const solo = {
      playerEmail: '',
      classId: 'fighter',
      secondClassId: 'rogue',
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id] },
    }
    const otherUnassigned = {
      playerEmail: '',
      classId: 'wizard',
      echoes: { ...emptyEchoes(), boons: [BOONS[1].id] },
    }
    const assigned = {
      playerEmail: 'alice@example.com',
      classId: 'cleric',
      echoes: { ...emptyEchoes(), boons: [BOONS[2].id] },
    }

    expect(playerCollection(solo, [solo, otherUnassigned, assigned])).toEqual({
      classIds: ['fighter', 'rogue'],
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id] },
    })
    expect(playerCollection({ classId: 'wizard', echoes: { ...emptyEchoes(), boons: [BOONS[1].id] } }, [otherUnassigned])).toEqual({
      classIds: ['wizard'],
      echoes: { ...emptyEchoes(), boons: [BOONS[1].id] },
    })
  })
})

describe('withPlayerCollections', () => {
  it('does not mutate its input and gives both characters of one player the same collection', () => {
    const c1 = {
      playerEmail: 'alice@example.com',
      classId: 'fighter',
      echoes: { ...emptyEchoes(), boons: [BOONS[0].id] },
    }
    const c2 = {
      playerEmail: 'alice@example.com',
      classId: 'wizard',
      echoes: { ...emptyEchoes(), boons: [BOONS[1].id] },
    }
    const c3 = {
      playerEmail: 'bob@example.com',
      classId: 'rogue',
      echoes: { ...emptyEchoes(), boons: [BOONS[2].id] },
    }
    const result = withPlayerCollections([c1, c2, c3])

    expect(result).toHaveLength(3)
    expect(result[0]).not.toBe(c1)
    expect(result[1]).not.toBe(c2)
    expect('collection' in c1).toBe(false)
    expect('collection' in c2).toBe(false)
    expect('collection' in c3).toBe(false)

    expect(result[0].collection).toEqual(result[1].collection)
    expect(result[0].collection.classIds).toEqual(['fighter', 'wizard'])
    expect(result[0].collection.echoes.boons).toEqual([BOONS[0].id, BOONS[1].id])
    expect(result[2].collection).toEqual({
      classIds: ['rogue'],
      echoes: { ...emptyEchoes(), boons: [BOONS[2].id] },
    })
  })
})
