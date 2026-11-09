import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { boon, BOONS } from './boons'
import {
  chooseHidden,
  chooseOffer,
  classTriggerMet,
  offerSize,
  openDrafts,
  openStartingBoons,
  passDraft,
  passHidden,
  rerollDraft,
  rerollsLeft,
  roomConditionMet,
} from './draftFlow'
import { clearRoom, defeatBoss, descend, draftsPending, newRunState, waitingOn } from './runFlow'

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

function start(pressures: string[] = [], chars = [character('a'), character('b', { classId: 'wizard', casterType: 'full' })]) {
  return newRunState('r', 'X', chars, pressures)
}

/** Clear a combat room and open drafts. */
const clearAndDraft = (state: RunState, random = seeded(1)) => openDrafts(clearRoom(state, 'combat'), 'combat', random)

describe('opening drafts', () => {
  it('each living player gets their own offer after a room', () => {
    const state = clearAndDraft(start())
    expect(state.players.every((p) => p.draft?.offers.length === 4)).toBe(true)
    expect(state.players[0].draft).toMatchObject({ floor: 1, room: 1, elite: false })
    expect(draftsPending(state)).toBe(true)
    expect(waitingOn(state)).toEqual(['a', 'b'])
  })

  it('Narrow Seam shrinks offers; Reprieve rooms have no draft', () => {
    expect([offerSize([]), offerSize(['narrow-seam']), offerSize(['narrow-seam-2'])]).toEqual([4, 3, 2])
    expect(clearAndDraft(start(['narrow-seam'])).players[0].draft?.offers).toHaveLength(3)
    const reprieve = openDrafts(clearRoom(start(), 'reprieve'), 'reprieve', seeded(1))
    expect(draftsPending(reprieve)).toBe(false)
  })

  it('bosses open a draft too, and Elite rooms are marked elite', () => {
    let state = start()
    for (let i = 0; i < 4; i++) state = passAll(clearAndDraft(state))
    state = openDrafts(defeatBoss(state), 'boss', seeded(2))
    expect(draftsPending(state)).toBe(true)
    const elite = openDrafts(clearRoom(start(), 'elite'), 'elite', seeded(3))
    expect(elite.players[0].draft?.elite).toBe(true)
  })

  it('the fallen get no draft', () => {
    let state = start()
    state = { ...state, players: state.players.map((p, i) => (i === 1 ? { ...p, alive: false } : p)) }
    state = clearAndDraft(state)
    expect(state.players[1].draft).toBeNull()
    expect(state.players[0].draft?.offers.length).toBeGreaterThan(0)
  })
})

describe('waiting on picks', () => {
  it('blocks the next room, the boss and descending until everyone has chosen', () => {
    let state = clearAndDraft(start())
    expect(() => clearRoom(state, 'combat')).toThrow('Waiting on draft picks from a, b')
    state = passDraft(state, 'a')
    expect(() => clearRoom(state, 'combat')).toThrow('Waiting on draft picks from b')
    state = chooseOffer(state, 'b', 1)
    expect(() => clearRoom(state, 'combat')).not.toThrow()
  })

  it('also blocks descending after the boss draft', () => {
    let state = start()
    for (let i = 0; i < 4; i++) state = passAll(clearAndDraft(state))
    state = openDrafts(defeatBoss(state), 'boss', seeded(4))
    expect(() => descend(state)).toThrow('Waiting on draft picks')
    expect(() => descend(passAll(state))).not.toThrow()
  })
})

describe('choosing', () => {
  it('taking an offer puts the boon in a slot and closes the draft', () => {
    let state = clearAndDraft(start())
    const offered = state.players[0].draft!.offers[1]
    state = chooseOffer(state, 'a', 1)
    expect(state.players[0].draft).toBeNull()
    expect(state.players[0].slots?.[0]).toMatchObject({ kind: 'boon', boonId: offered.kind === 'boon' ? offered.boonId : '', level: 1 })
  })

  it('taking the held offer levels that boon up', () => {
    let state = chooseOffer(clearAndDraft(start()), 'a', 0)
    state = passDraft(state, 'b')
    const held = state.players[0].slots![0]!
    state = clearAndDraft(state, seeded(8))
    expect(state.players[0].draft!.offers[0]).toMatchObject({ source: 'held' })
    state = chooseOffer(state, 'a', 0)
    expect(state.players[0].slots![0]).toMatchObject({ ...held, level: 2 })
  })

  it('with every slot full, a new boon needs a slot to replace', () => {
    let state = start()
    for (let i = 0; i < 3; i++) {
      state = clearAndDraft(state, seeded(20 + i))
      const pick = state.players[0].draft!.offers.findIndex((o) => o.kind === 'boon' && o.source !== 'held')
      state = passDraft(chooseOffer(state, 'a', pick), 'b')
    }
    state = clearAndDraft(state, seeded(30))
    const fresh = state.players[0].draft!.offers.findIndex((o) => o.kind === 'boon' && o.source !== 'held')
    expect(() => chooseOffer(state, 'a', fresh)).toThrow('No empty slot')
    const replaced = chooseOffer(state, 'a', fresh, 2)
    expect(replaced.players[0].slots![2]).toMatchObject({ level: 1 })
  })

  it('passing pays the pass bonus and closes the draft', () => {
    const state = passDraft(clearAndDraft(start()), 'a')
    expect(state.players[0].draft).toBeNull()
    expect(state.players[0].quantumBasaltsPassed).toBe(1)
    expect(() => passDraft(state, 'a')).toThrow('no draft')
  })
})

describe('rerolls', () => {
  it('use the Reroll upgrade\'s per-floor allowance', () => {
    const chars = [character('a', { upgrades: { reroll: 2 } })]
    let state = clearAndDraft(start([], chars))
    expect(rerollsLeft(state.players[0], 1)).toBe(2)
    state = rerollDraft(state, 'a', seeded(50))
    state = rerollDraft(state, 'a', seeded(51))
    expect(rerollsLeft(state.players[0], 1)).toBe(0)
    expect(() => rerollDraft(state, 'a', seeded(52))).toThrow('No rerolls left')
  })

  it('players without the upgrade can\'t reroll', () => {
    expect(() => rerollDraft(clearAndDraft(start()), 'a', seeded(1))).toThrow('No rerolls left')
  })
})

describe('Attunement and Banish', () => {
  it('the first offer of the run includes the attuned tag', () => {
    const chars = [character('a', { upgrades: { attunement: 1 }, attuneTag: 'Guard' })]
    for (let seed = 1; seed < 30; seed++) {
      const offers = clearAndDraft(start([], chars), seeded(seed)).players[0].draft!.offers
      expect(offers.some((o) => o.kind === 'boon' && boon(o.boonId).tags[0] === 'Guard')).toBe(true)
    }
  })

  it('an attuned tag without the upgrade is ignored', () => {
    const p = start([], [character('a', { attuneTag: 'Guard' })]).players[0]
    expect(p.draftProfile?.attuneTag).toBeNull()
  })

  it('banished boons never show up in offers', () => {
    const chars = [character('a', { banished: ['hardy', 'honed', 'fleet-foot'] })]
    for (let seed = 1; seed < 100; seed++) {
      const offers = clearAndDraft(start([], chars), seeded(seed)).players[0].draft!.offers
      for (const o of offers) if (o.kind === 'boon') expect(['hardy', 'honed', 'fleet-foot']).not.toContain(o.boonId)
    }
  })
})

describe('hidden offers', () => {
  it('a met room condition offers each living player 2 gifts', () => {
    const state = roomConditionMet(start(), seeded(3))
    for (const p of state.players) expect(p.hiddenOffer?.gifts).toHaveLength(2)
  })

  it('a class trigger offers that class\'s hidden boon; both together give 3 to choose from', () => {
    let state = roomConditionMet(start(), seeded(3))
    state = classTriggerMet(state, 'b')
    expect(state.players[1].hiddenOffer?.classBoon).toBe('the-archivist')
    expect(state.players[1].hiddenOffer?.gifts).toHaveLength(2)
  })

  it('taking a hidden boon fills the hidden slot; passing pays the pass bonus', () => {
    let state = classTriggerMet(start(), 'b')
    state = chooseHidden(state, 'b', 'the-archivist')
    expect(state.players[1].hiddenBoonId).toBe('the-archivist')
    expect(state.players[1].hiddenOffer).toBeNull()
    state = passHidden(roomConditionMet(state, seeded(4)), 'a')
    expect(state.players[0].quantumBasaltsPassed).toBe(1)
    expect(() => chooseHidden(state, 'a', 'trapwise')).toThrow('No hidden offer')
  })

  it('a hidden offer doesn\'t hold up the next room', () => {
    const state = roomConditionMet(start(), seeded(5))
    expect(() => clearRoom(state, 'combat')).not.toThrow()
  })
})

/** Everyone still choosing passes. */
function passAll(state: RunState): RunState {
  return state.players.reduce((s, p) => (p.alive && p.draft ? passDraft(s, p.characterId) : s), state)
}

describe('Starting Boon', () => {
  const owners = [character('a', { upgrades: { 'starting-boon': 1, reroll: 1 } }), character('b')]

  it('offers each owner one random boon before room 1, and blocks room 1 until chosen', () => {
    const state = openStartingBoons(start([], owners), ['a'], seeded(3))
    expect(state.players[0].draft).toMatchObject({ starting: true, room: 0 })
    expect(state.players[0].draft!.offers).toHaveLength(1)
    expect(state.players[0].draft!.offers[0]).toMatchObject({ kind: 'boon', source: 'starting' })
    expect(state.players[1].draft).toBeNull()
    expect(() => clearRoom(state, 'combat')).toThrow('Waiting on draft picks from a')
  })

  it('taking it puts the boon in at Level 1; Attunement still shapes the first room\'s offer', () => {
    const chars = [character('a', { upgrades: { 'starting-boon': 1, attunement: 1 }, attuneTag: 'Guard' })]
    let state = openStartingBoons(start([], chars), ['a'], seeded(4))
    state = chooseOffer(state, 'a', 0)
    expect(state.players[0].slots![0]).toMatchObject({ level: 1 })
    expect(state.players[0].draftsSeen).toBe(0)
    state = clearAndDraft(state, seeded(5))
    expect(state.players[0].draft!.offers.some((o) => o.kind === 'boon' && boon(o.boonId).tags[0] === 'Guard')).toBe(true)
  })

  it('can be rerolled (using a reroll) into another single boon, and respects Banish', () => {
    let state = openStartingBoons(start([], owners), ['a'], seeded(6))
    state = rerollDraft(state, 'a', seeded(7))
    expect(state.players[0].draft).toMatchObject({ starting: true })
    expect(state.players[0].draft!.offers).toHaveLength(1)
    const banished = BOONS.map((b) => b.id).filter((id) => id !== 'hardy')
    const onlyHardy = [character('a', { upgrades: { 'starting-boon': 1 }, banished })]
    const offered = openStartingBoons(start([], onlyHardy), ['a'], seeded(8)).players[0].draft!.offers[0]
    expect(offered).toMatchObject({ boonId: 'hardy' })
  })
})
