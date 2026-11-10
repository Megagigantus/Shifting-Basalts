import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { takeBoon } from './boons'
import {
  canExtract,
  changeSlots,
  setHiddenBoon,
  clearRoom,
  defeatBoss,
  descend,
  extract,
  isBossRoom,
  isFullClear,
  makeJoinCode,
  markDead,
  newRunState,
  pass,
  runResults,
} from './runFlow'

const char = (id: string, level: number): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level,
})
const twos = () => 2

function start(levels = [9, 10, 11, 12], pressures: string[] = []): RunState {
  return newRunState('r1', 'ABCD', levels.map((l, i) => char(`c${i}`, l)), pressures)
}

/** Clear a floor's 4 combat rooms and beat its boss. */
function clearFloor(state: RunState): RunState {
  for (let i = 0; i < 4; i++) state = clearRoom(state, 'combat')
  return defeatBoss(state)
}

describe('starting a run', () => {
  it('sets party level, size and multiplier from the characters', () => {
    const { run, players } = start([9, 10, 11, 12], ['brittle-ground', 'narrow-seam'])
    expect(run.partyLevel).toBe(10)
    expect(run.partySize).toBe(4)
    expect(run.entryMultiplier).toBe(1)
    expect(run.pressureBonusPercent).toBe(25)
    expect(run.floor).toBe(1)
    expect(run.room).toBe(1)
    expect(players.every((p) => p.alive && p.devotions === 0)).toBe(true)
  })

  it('needs at least one character', () => {
    expect(() => newRunState('r', 'X', [], [])).toThrow()
  })
})

describe('floor progress', () => {
  it('reaches the boss after 4 rooms, with one Devotion per room', () => {
    let state = start()
    for (let i = 0; i < 4; i++) {
      expect(isBossRoom(state)).toBe(false)
      state = clearRoom(state, 'combat')
    }
    expect(isBossRoom(state)).toBe(true)
    expect(state.players[0].devotions).toBe(4)
    expect(() => clearRoom(state, 'combat')).toThrow()
  })

  it('elite rooms pay 2 Devotions and Reprieves pay none but use up a room', () => {
    let state = start()
    state = clearRoom(state, 'elite')
    state = clearRoom(state, 'reprieve')
    expect(state.players[0].devotions).toBe(2)
    expect(state.run.room).toBe(3)
  })

  it('a boss pays Devotion and Quantum Basalts, then offers the choice', () => {
    const state = clearFloor(start())
    expect(state.run.awaitingChoice).toBe(true)
    expect(state.run.lastBossFloor).toBe(1)
    expect(state.players[0].devotions).toBe(5)
    expect(state.players[0].quantumBasaltsEarned).toBe(5)
    expect(canExtract(state)).toBe(true)
    expect(() => clearRoom(state, 'combat')).toThrow()
  })

  it('cannot beat the boss early or extract before any boss', () => {
    const state = start()
    expect(() => defeatBoss(state)).toThrow()
    expect(canExtract(state)).toBe(false)
    expect(() => extract(state)).toThrow()
  })

  it('descending moves to the next floor', () => {
    const state = descend(clearFloor(start()))
    expect(state.run.floor).toBe(2)
    expect(state.run.room).toBe(1)
    expect(state.run.awaitingChoice).toBe(false)
  })

  it('floor 5 is a single boss, and beating it is a full clear', () => {
    let state = start()
    for (let f = 1; f <= 4; f++) state = descend(clearFloor(state))
    expect(state.run.floor).toBe(5)
    expect(isBossRoom(state)).toBe(true)
    state = defeatBoss(state)
    // The run waits for Thils's Vault, then extracts with everything kept.
    expect(state.run.status).toBe('active')
    expect(isFullClear(state)).toBe(true)
    expect(() => descend(state)).toThrow('no deeper floor')
    state = extract(state)
    expect(state.run.status).toBe('extracted')
    expect(state.run.lootKeptPercent).toBe(100)
    expect(state.players[0].quantumBasaltsEarned).toBe(65)
    expect(state.players[0].devotions).toBe(21)
  })
})

describe('finishing rooms with loot', () => {
  it('rolls a room\'s loot before clearing it, and a boss cache before the boss is beaten', async () => {
    const { finishRoom } = await import('./progress')
    const { passDraft } = await import('./draftFlow')
    let state = start()
    state = finishRoom(state, 'combat', () => 0.01) // d100 = 2: credits on floor 1
    expect(state.run.loot?.log).toEqual([{ floor: 1, room: 1, source: 'room', credits: 20 }])
    expect(state.run.room).toBe(2)
    for (const p of state.players) state = passDraft(state, p.characterId)
    state = { ...state, run: { ...state.run, room: 5 } }
    state = finishRoom(state, 'boss', () => 0.01)
    expect(state.run.loot?.log.filter((l) => l.source === 'cache').every((l) => l.room === 5)).toBe(true)
    expect(state.run.awaitingChoice).toBe(true)
  })

  it('opens Thils\'s Vault after the legendary boss, and extraction waits for it', async () => {
    const { finishRoom } = await import('./progress')
    const { chooseRelic } = await import('./vault')
    let state = start()
    for (let f = 1; f <= 4; f++) state = descend(clearFloor(state))
    state = finishRoom(state, 'boss', Math.random)
    expect(state.run.vaultOpen).toBe(true)
    expect(() => extract(state)).toThrow('Vault')
    for (const p of state.players) state = chooseRelic(state, p.characterId, p.vaultOffer![0])
    state = extract(state)
    const results = runResults(state)
    expect(results[0].loot.at(-1)).toMatchObject({ kind: 'relic', relicState: 'dormant', source: 'vault' })
  })

  it('gives assigned items to their characters, fallen ones too, and nothing on a wipe', () => {
    let state = clearFloor(start())
    state = {
      ...state,
      run: {
        ...state.run,
        loot: {
          items: [{ uid: 'L1', kind: 'trinket', ref: '0', rarity: null, floor: 1, room: 1, source: 'room' }],
          credits: 1000,
          nextUid: 2,
          log: [],
          searched: [],
        },
      },
    }
    const fallen = state.players[1].characterId
    state = markDead(state, fallen, () => 1)
    const ended = extract(state, [{ uid: 'L1', characterId: fallen }])
    expect(ended.run.lootShare).toMatchObject({ keptValue: 252, itemsValue: 10, creditsPayout: 242 })
    expect(runResults(ended).find((r) => r.characterId === fallen)?.loot.map((i) => i.uid)).toEqual(['L1'])
  })
})

describe('extracting', () => {
  it('keeps loot by the last boss and pays Quantum Basalts with Pressure bonuses', () => {
    let state = start([5, 5], ['brittle-ground']) // +10%
    state = descend(clearFloor(state))
    state = clearFloor(state) // bosses 1 and 2: 5 + 8 = 13
    state = pass(state, 'c0') // +1, no bonus
    state = extract(state)
    expect(state.run.lootKeptPercent).toBe(40)
    const [a, b] = runResults(state)
    expect(a.quantumBasaltsGained).toBe(15 + 1) // ceil(14.3) + pass
    expect(b.quantumBasaltsGained).toBe(15)
    expect(a.deepestFloor).toBe(2)
    expect(a.survived).toBe(true)
  })

  it('higher entry tiers multiply boss and pass payouts', () => {
    let state = start([17, 18])
    expect(state.run.entryMultiplier).toBe(4)
    state = pass(clearFloor(state), 'c0')
    state = extract(state)
    expect(runResults(state)[0].quantumBasaltsGained).toBe(20 + 4)
  })
})

describe('death', () => {
  it('locks the character out 1d4 per floor and forfeits all but passed Basalts', () => {
    let state = clearFloor(start([5, 5]))
    state = descend(state)
    state = pass(state, 'c1')
    state = markDead(state, 'c1', twos)
    const fallen = state.players[1]
    expect(fallen.alive).toBe(false)
    expect(fallen.diedOnFloor).toBe(2)
    expect(fallen.lockoutDays).toBe(4)
    expect(() => pass(state, 'c1')).toThrow()

    // The survivor carries on and extracts; the fallen keep only passed Basalts.
    state = extract(clearFloor(state))
    const [survivor, dead] = runResults(state)
    expect(survivor.quantumBasaltsGained).toBe(13)
    expect(dead.quantumBasaltsGained).toBe(1)
    expect(dead.lockoutDays).toBe(4)
    expect(dead.deepestFloor).toBe(2)
  })

  it('the fallen stop earning Devotions and boss Basalts', () => {
    let state = markDead(start([5, 5]), 'c1', twos)
    state = clearFloor(state)
    expect(state.players[1].devotions).toBe(0)
    expect(state.players[1].quantumBasaltsEarned).toBe(0)
    expect(state.players[0].devotions).toBe(5)
  })

  it('a wipe ends the run and loses the loot', () => {
    let state = clearFloor(start([5, 5]))
    state = markDead(state, 'c0', twos)
    state = markDead(state, 'c1', twos)
    expect(state.run.status).toBe('wiped')
    expect(state.run.lootKeptPercent).toBe(0)
    expect(runResults(state).every((r) => r.quantumBasaltsGained === 0)).toBe(true)
  })
})

describe('upgrades in a run', () => {
  const withUpgrades = (id: string, level: number, upgrades: Record<string, number>) => ({
    ...char(id, level),
    upgrades,
  })

  it('stacks Pressures, Extra Pressures owners and Extra Loot, rounding up once', () => {
    // Bible example: 40 Basalts with +25% Pressures and Extra Loot rank 2 (+20%) pays 58.
    const party = [withUpgrades('a', 5, { 'extra-loot': 2 }), withUpgrades('b', 5, {})]
    let state = newRunState('r', 'X', party, ['brittle-ground', 'closing-ring']) // +25%
    for (let f = 1; f <= 4; f++) {
      state = clearFloor(state)
      if (f < 4) state = descend(state)
    }
    expect(state.players[0].quantumBasaltsEarned).toBe(40)
    const [a, b] = runResults(extract(state))
    expect(a.quantumBasaltsGained).toBe(58)
    expect(b.quantumBasaltsGained).toBe(50) // 40 x 1.25
  })

  it('every Extra Pressures owner adds 5% for the whole party', () => {
    const party = [withUpgrades('a', 5, { 'extra-pressures': 1 }), withUpgrades('b', 5, { 'extra-pressures': 2 })]
    const state = extract(clearFloor(newRunState('r', 'X', party, [])))
    expect(state.run.extraPressuresBonusPercent).toBe(10)
    expect(runResults(state).map((r) => r.quantumBasaltsGained)).toEqual([6, 6]) // ceil(5 x 1.10)
  })

  it('Extra Loot never boosts passed Basalts', () => {
    const party = [withUpgrades('a', 5, { 'extra-loot': 3 })]
    let state = newRunState('r', 'X', party, [])
    state = pass(pass(state, 'a'), 'a')
    state = extract(clearFloor(state))
    expect(runResults(state)[0].quantumBasaltsGained).toBe(7 + 2) // ceil(5 x 1.30) + 2 passes
  })

  it('Deep Pockets uses the highest rank and caps loot kept at 100%', () => {
    const party = [withUpgrades('a', 5, { 'deep-pockets': 1 }), withUpgrades('b', 5, { 'deep-pockets': 3 })]
    let state = clearFloor(newRunState('r', 'X', party, []))
    expect(extract(state).run.lootKeptPercent).toBe(40) // 25 + 15
    for (let f = 2; f <= 4; f++) state = clearFloor(descend(state))
    expect(extract(state).run.lootKeptPercent).toBe(95) // 80 + 15
  })

  it('Quick Return shortens a lockout, never below 1 day', () => {
    const party = [withUpgrades('a', 5, { 'quick-return': 3 }), withUpgrades('b', 5, {})]
    let state = descend(clearFloor(newRunState('r', 'X', party, [])))
    state = markDead(state, 'a', twos) // rolled 2 + 2 = 4, minus 3
    expect(state.players[0].lockoutDays).toBe(1)
    expect(state.players[0].lockoutRolls).toEqual([2, 2])
    const ones = () => 1
    const other = markDead(descend(clearFloor(newRunState('r', 'X', party, []))), 'a', ones) // 2 - 3
    expect(other.players[0].lockoutDays).toBe(1)
  })
})

describe('boons in a run', () => {
  it('each player starts with empty slots sized by Extra Boon Slot, and no hidden boon', () => {
    const party = [char('a', 5), { ...char('b', 5), upgrades: { 'extra-boon-slot': 2 } }]
    const { players } = newRunState('r', 'X', party, [])
    expect(players[0].slots).toEqual([null, null, null])
    expect(players[1].slots).toHaveLength(5)
    expect(players[0].hiddenBoonId).toBeNull()
  })

  it('changes one player\'s slots and hidden boon', () => {
    let state = start([5, 5])
    state = changeSlots(state, 'c0', (s) => takeBoon(s, 'hardy'))
    state = setHiddenBoon(state, 'c1', 'keeper-of-ways')
    expect(state.players[0].slots?.[0]).toMatchObject({ boonId: 'hardy', level: 1 })
    expect(state.players[1].slots).toEqual([null, null, null])
    expect(state.players[1].hiddenBoonId).toBe('keeper-of-ways')
    expect(() => setHiddenBoon(state, 'c1', 'not-a-boon')).toThrow()
  })

  it('fallen players can\'t change boons', () => {
    const state = markDead(start([5, 5]), 'c1', twos)
    expect(() => changeSlots(state, 'c1', (s) => takeBoon(s, 'hardy'))).toThrow('fallen')
  })
})

describe('join codes', () => {
  it('are 4 easy-to-read characters', () => {
    const code = makeJoinCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/)
  })
})
