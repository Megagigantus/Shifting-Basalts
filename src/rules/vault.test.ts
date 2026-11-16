import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { newRunState, markDead } from './runFlow'
import { chooseRelic, heldRelics, mustTradeOrPass, openVault, passVault, relicStateFor, relicWeight, vaultPending, wakeLine, RELICS } from './vault'

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

const char = (id: string, classId = 'fighter', level = 5): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  classId,
  level,
})

const party = (chars: Character[]): RunState => newRunState('r', 'X', chars, [])

describe('Thils\'s Vault', () => {
  it('offers each survivor 3 relics, 4 at entry 17 to 20, and none to the fallen', () => {
    let state = markDead(party([char('a'), char('b'), char('c')]), 'c', () => 1)
    state = openVault(state, seeded(1))
    expect(state.run.vaultOpen).toBe(true)
    expect(state.players[0].vaultOffer).toHaveLength(3)
    expect(state.players[1].vaultOffer).toHaveLength(3)
    expect(state.players[2].vaultOffer).toBeUndefined()
    const high = openVault(party([char('a', 'fighter', 18)]), seeded(1))
    expect(high.players[0].vaultOffer).toHaveLength(4)
  })

  it('never offers a relic anyone in the party owns, and keeps offers different between players', () => {
    let state = party([char('a'), char('b'), char('c')])
    state = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, relicsOwned: ['breakers-wraps'] } : p)) }
    for (let seed = 1; seed <= 50; seed++) {
      const opened = openVault(state, seeded(seed))
      const all = opened.players.flatMap((p) => p.vaultOffer ?? [])
      expect(all).not.toContain('breakers-wraps')
      expect(new Set(all).size).toBe(all.length)
    }
  })

  it('weights relics like boon offers', () => {
    const fighter = { draftProfile: { classId: 'fighter' } as never, slots: [] }
    // Fighter: Crit is primary (x3); Volley secondary (x2); Bond neither.
    expect(relicWeight('glints-scabbard', fighter)).toBe(3)
    expect(relicWeight('elemain-ricochet-ring', fighter)).toBe(2)
    expect(relicWeight('collectors-cage', fighter)).toBe(1)
  })

  it('a player takes one offered relic; nobody can take one already taken', () => {
    let state = openVault(party([char('a'), char('b')]), seeded(2))
    const relic = state.players[0].vaultOffer![0]
    expect(vaultPending(state)).toBe(true)
    state = chooseRelic(state, 'a', relic)
    expect(state.players[0]).toMatchObject({ vaultRelic: relic, vaultOffer: null })
    expect(() => chooseRelic(state, 'b', 'not-offered')).toThrow('isn\'t in their offer')
    const forced = { ...state, players: state.players.map((p) => (p.characterId === 'b' ? { ...p, vaultOffer: [relic] } : p)) }
    expect(() => chooseRelic(forced, 'b', relic)).toThrow('already taken')
    state = chooseRelic(state, 'b', state.players[1].vaultOffer![0])
    expect(vaultPending(state)).toBe(false)
  })

  it('relics are Dormant at entry 5 to 10 and Awoken from 11', () => {
    expect(relicStateFor(10)).toBe('dormant')
    expect(relicStateFor(11)).toBe('woken')
    expect(RELICS).toHaveLength(15)
  })

  it('a relic owner trades their relic in when taking an offer, and a relic-less player has no trade-in', () => {
    let state = party([char('a'), char('b')])
    state = { ...state, players: state.players.map((p) => (p.characterId === 'a' ? { ...p, relicsOwned: ['breakers-wraps'] } : p)) }
    expect(heldRelics(state.players[0])).toEqual(['breakers-wraps'])
    expect(mustTradeOrPass(state.players[0])).toBe(true)
    expect(mustTradeOrPass(state.players[1])).toBe(false)

    state = openVault(state, seeded(3))
    const allOffered = state.players.flatMap((p) => p.vaultOffer ?? [])
    expect(allOffered).not.toContain('breakers-wraps')

    state = chooseRelic(state, 'a', state.players[0].vaultOffer![0])
    expect(state.players[0].vaultTradeIn).toEqual(['breakers-wraps'])
    expect(allOffered).not.toContain('breakers-wraps')

    state = chooseRelic(state, 'b', state.players[1].vaultOffer![0])
    expect(state.players[1].vaultTradeIn).toBeNull()
  })

  it('a relic owner can pass the Vault for a flat 100 Quantum Basalts, while relic-less players cannot', () => {
    let state = party([char('a', 'fighter', 18), char('b', 'fighter', 18)])
    expect(state.run.entryMultiplier).toBe(4)
    state = { ...state, players: state.players.map((p) => (p.characterId === 'a' ? { ...p, relicsOwned: ['breakers-wraps'] } : p)) }
    expect(() => passVault(state, 'a')).toThrow('isn\'t open')

    state = openVault(state, seeded(4))
    expect(() => passVault(state, 'nobody')).toThrow('isn\'t in this run')
    expect(() => passVault(state, 'b')).toThrow('Only a character who already owns a relic can pass the Vault.')

    state = passVault(state, 'a')
    expect(state.players[0]).toMatchObject({
      vaultPassed: true,
      vaultOffer: null,
      vaultRelic: null,
      vaultTradeIn: null,
      quantumBasaltsPassed: 100,
    })
    expect(() => passVault(state, 'a')).toThrow('already chose')
    expect(vaultPending(state)).toBe(true)

    state = chooseRelic(state, 'b', state.players[1].vaultOffer![0])
    expect(vaultPending(state)).toBe(false)
  })

  it('cannot pass after taking a relic or when fallen', () => {
    let state = party([char('a'), char('b')])
    state = { ...state, players: state.players.map((p) => ({ ...p, relicsOwned: [p.characterId === 'a' ? 'breakers-wraps' : 'corrows-fishhook'] })) }
    state = markDead(state, 'b', () => 1)
    state = openVault(state, seeded(5))
    expect(() => passVault(state, 'b')).toThrow('fell before the Vault')
    state = chooseRelic(state, 'a', state.players[0].vaultOffer![0])
    expect(() => passVault(state, 'a')).toThrow('already chose')
  })

  it('formats the wake line from data without placeholders', () => {
    expect(wakeLine()).toBe('Wakes when its bearer reaches level 11 and offers 40 Quantum Basalts at a shrine to Thils.')
    expect(wakeLine()).not.toContain('{')
  })
})
