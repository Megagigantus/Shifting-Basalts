import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import { takeBoon } from './boons'
import { forgeOptions, forgeUsesLeft, spendForge } from './forge'
import { changeSlots, clearRoom, defeatBoss, descend, markDead, newRunState } from './runFlow'

const char = (id: string, forge = false): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  upgrades: forge ? { forge: 1 } : {},
})

function toBoss(state: RunState): RunState {
  for (let i = 0; i < 4; i++) state = clearRoom(state, 'combat')
  return defeatBoss(state)
}

const withBoons = (state: RunState, id: string, boons: string[]) =>
  changeSlots(state, id, (s) => boons.reduce((acc, b) => takeBoon(acc, b), s))

describe('the Forge', () => {
  it('gives one use per living owner after a boss, and none without owners', () => {
    expect(forgeUsesLeft(toBoss(newRunState('r', 'X', [char('a', true), char('b', true), char('c')], [])))).toBe(2)
    expect(forgeUsesLeft(toBoss(newRunState('r', 'X', [char('a'), char('b')], [])))).toBe(0)
  })

  it('fallen owners don\'t add uses', () => {
    let state = newRunState('r', 'X', [char('a', true), char('b', true)], [])
    state = markDead(state, 'b', () => 1)
    expect(forgeUsesLeft(toBoss(state))).toBe(1)
  })

  it('is only open in the post-boss room and cools on descending', () => {
    const start = newRunState('r', 'X', [char('a', true)], [])
    expect(forgeUsesLeft(start)).toBe(0)
    const atForge = toBoss(start)
    expect(forgeUsesLeft(atForge)).toBe(1)
    expect(forgeUsesLeft(descend(atForge))).toBe(0)
  })

  it('a use levels up a boon, and the Forge cools when uses run out', () => {
    let state = withBoons(toBoss(newRunState('r', 'X', [char('a', true)], [])), 'a', ['hardy'])
    expect(forgeOptions(state.players[0].slots!)).toEqual([{ kind: 'level', slotIndex: 0 }])
    state = spendForge(state, 'a', { kind: 'level', slotIndex: 0 })
    expect(state.players[0].slots![0]).toMatchObject({ boonId: 'hardy', level: 2 })
    expect(forgeUsesLeft(state)).toBe(0)
    expect(() => spendForge(state, 'a', { kind: 'level', slotIndex: 0 })).toThrow('cooled')
  })

  it('can evolve or combine Level 3 boons', () => {
    let state = toBoss(newRunState('r', 'X', [char('a', true), char('b', true)], []))
    state = withBoons(state, 'a', ['traverts-echoes', 'traverts-echoes', 'traverts-echoes'])
    state = withBoons(state, 'b', [
      'critical-delight', 'critical-delight', 'critical-delight',
      'crits-are-for-suckers', 'crits-are-for-suckers', 'crits-are-for-suckers',
    ])
    expect(forgeOptions(state.players[0].slots!)).toContainEqual({ kind: 'evolve', slotIndex: 0 })
    state = spendForge(state, 'a', { kind: 'evolve', slotIndex: 0 })
    state = spendForge(state, 'b', { kind: 'combine', combinationId: 'super-normal' })
    expect(state.players[0].slots![0]).toMatchObject({ kind: 'evolution', evolutionId: 'chain-of-echoes' })
    expect(state.players[1].slots![0]).toMatchObject({ kind: 'combination', combinationId: 'super-normal' })
    expect(forgeUsesLeft(state)).toBe(0)
  })

  it('refuses moves that aren\'t allowed', () => {
    const state = withBoons(toBoss(newRunState('r', 'X', [char('a', true)], [])), 'a', ['hardy'])
    expect(() => spendForge(state, 'a', { kind: 'evolve', slotIndex: 0 })).toThrow()
    expect(() => spendForge(state, 'nobody', { kind: 'level', slotIndex: 0 })).toThrow()
  })
})
