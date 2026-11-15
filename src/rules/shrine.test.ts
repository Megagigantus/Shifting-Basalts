import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { clearRoom, defeatBoss, descend, markDead, newRunState, runResults, extract } from './runFlow'
import { pledgedTotal, reclaim, reclaimable, shrineCost, shrineHere, type Pledge } from './shrine'

const char = (id: string, shrine = false): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 8,
  upgrades: shrine ? { 'reclamation-shrine': 1 } : {},
})
const twos = () => 2
const player = (state: RunState, id: string) => state.players.find((p) => p.characterId === id)!

/** c0 owns the Shrine; c2 dies in the floor's boss room, then the boss falls. */
function bossDown(shrineOwner = 'c0'): RunState {
  let state = newRunState('r1', 'ABCD', ['c0', 'c1', 'c2'].map((id) => char(id, id === shrineOwner)), [])
  for (let i = 0; i < 4; i++) state = clearRoom(state, 'combat')
  return defeatBoss(markDead(state, 'c2', twos))
}
const pledge = (targetId: string, amount: number, floor = 1): Pledge => ({ targetId, amount, floor })

describe('the Reclamation Shrine', () => {
  it('stands in the post-boss room once anyone owns it, fallen owners too', () => {
    expect(shrineHere(bossDown())).toBe(true)
    expect(shrineHere(bossDown('c2'))).toBe(true)
    expect(shrineHere(bossDown('nobody'))).toBe(false)
  })

  it('costs 5 × floor × entry multiplier', () => {
    expect(shrineCost(bossDown())).toBe(5)
  })

  it('only reclaims allies lost on this floor', () => {
    let state = bossDown()
    expect(reclaimable(state).map((p) => p.characterId)).toEqual(['c2'])
    state = descend(state)
    for (let i = 0; i < 4; i++) state = clearRoom(state, 'combat')
    state = defeatBoss(state)
    expect(reclaimable(state)).toEqual([])
    expect(shrineCost(state)).toBe(10)
  })

  it('counts only living pledgers, this floor, up to what they earned', () => {
    const state = bossDown()
    // Each survivor earned 5 from the floor 1 boss.
    expect(pledgedTotal(state, { c0: pledge('c2', 99), c1: pledge('c2', 3, 0), c2: pledge('c2', 5) }, 'c2')).toBe(5)
  })

  it('refuses until the pledges cover the cost', () => {
    expect(() => reclaim(bossDown(), 'c2', { c0: pledge('c2', 4) })).toThrow('needs 5')
  })

  it('brings the ally back with boons, run Basalts and no lockout, paid from pledges in party order', () => {
    const before = bossDown()
    const fallen = player(before, 'c2')
    const { state, paid } = reclaim(before, 'c2', { c0: pledge('c2', 3), c1: pledge('c2', 5) })
    expect(paid).toEqual({ c0: 3, c1: 2 })
    expect(player(state, 'c0').quantumBasaltsEarned).toBe(2)
    expect(player(state, 'c1').quantumBasaltsEarned).toBe(3)
    expect(player(state, 'c2')).toMatchObject({
      alive: true,
      diedOnFloor: null,
      lockoutDays: null,
      slots: fallen.slots,
      quantumBasaltsEarned: fallen.quantumBasaltsEarned,
    })
    const results = runResults(extract(state))
    expect(results.find((r) => r.characterId === 'c2')).toMatchObject({ survived: true, lockoutDays: null })
  })

  it('can\'t reclaim someone twice', () => {
    const { state } = reclaim(bossDown(), 'c2', { c0: pledge('c2', 5) })
    expect(() => reclaim(state, 'c2', { c1: pledge('c2', 5) })).toThrow('this floor')
  })
})
