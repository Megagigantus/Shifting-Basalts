import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { finishRoom } from './progress'
import { grantRecovery, recoverSlot, recoverableLevels, recoveryCost, recoveryRank, spendSurge } from './recovery'
import { newRunState } from './runFlow'
import { passDraft } from './draftFlow'

const caster = (id: string, devotions: number, slotLevels = [1, 2, 3]): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  casterType: 'full',
  slotLevels,
  trackDevotions: { 'spell-slot-recovery': devotions },
})

const fighter = (id: string): Character => ({ ...emptyProfile(), ...emptyDungeonLayer(), id, name: id, level: 5 })

// 3 Devotions buy rank 1, so 15 buy rank 5.
const start = (chars: Character[] = [caster('w', 15), fighter('f')]): RunState => newRunState('r', 'X', chars, [])

describe('slot recovery points', () => {
  it('casters gain their track rank in points; non-casters and rank 0 gain none', () => {
    const state = grantRecovery(start([caster('w', 15), caster('none', 0), fighter('f')]))
    expect(recoveryRank(state.players[0])).toBe(5)
    expect(state.players[0].recovery).toEqual({ points: 5, bought: [], surged: 0 })
    expect(state.players[1].recovery).toBeNull()
    expect(state.players[2].recovery).toBeNull()
  })

  it('cost 2, 3, 5, 6 and 7 points for 1st to 5th level, and nothing above 5th', () => {
    expect([1, 2, 3, 4, 5].map(recoveryCost)).toEqual([2, 3, 5, 6, 7])
    expect(recoveryCost(6)).toBeNull()
    expect(recoverableLevels({ slotLevels: [1, 2, 3, 6, 9] })).toEqual([1, 2, 3])
  })

  it('buy slots the caster has, while points last', () => {
    let state = grantRecovery(start())
    state = recoverSlot(state, 'w', 2)
    expect(state.players[0].recovery).toEqual({ points: 2, bought: [2], surged: 0 })
    expect(() => recoverSlot(state, 'w', 3)).toThrow('costs 5 points')
    expect(() => recoverSlot(state, 'w', 4)).toThrow('no level 4 slots')
    state = recoverSlot(state, 'w', 1)
    expect(state.players[0].recovery?.points).toBe(0)
  })

  it('leftovers fade at the next clear that pays a Devotion, but not after a Reprieve', () => {
    let state = recoverSlot(grantRecovery(start()), 'w', 1) // 3 left
    state = finishRoom(state, 'reprieve', () => 0.5)
    expect(state.players[0].recovery).toEqual({ points: 3, bought: [1], surged: 0 })
    for (const p of state.players) if (p.draft) state = passDraft(state, p.characterId)
    state = finishRoom(state, 'combat', () => 0.5)
    expect(state.players[0].recovery).toEqual({ points: 5, bought: [], surged: 0 })
  })

  it('Leyline Surge spends 1 point at a time, only for its holder', () => {
    let state = grantRecovery(start())
    expect(() => spendSurge(state, 'w')).toThrow('doesn\'t hold Leyline Surge')
    state = {
      ...state,
      players: state.players.map((p) =>
        p.characterId === 'w' ? { ...p, slots: [{ kind: 'boon', boonId: 'leyline-surge', level: 1 }, null, null] } : p,
      ),
    }
    state = spendSurge(spendSurge(state, 'w'), 'w')
    expect(state.players[0].recovery).toEqual({ points: 3, bought: [], surged: 2 })
  })
})
