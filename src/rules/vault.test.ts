import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { newRunState, markDead } from './runFlow'
import { chooseRelic, openVault, relicStateFor, relicWeight, vaultPending, RELICS } from './vault'

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

  it('relics are Dormant at entry 5 to 10 and Woken from 11', () => {
    expect(relicStateFor(10)).toBe('dormant')
    expect(relicStateFor(11)).toBe('woken')
    expect(RELICS).toHaveLength(15)
  })
})
