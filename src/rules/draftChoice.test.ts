import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import { applyChoice, draftKey } from './draftChoice'
import { openDrafts, roomConditionMet } from './draftFlow'
import { clearRoom, newRunState } from './runFlow'

const random = () => 0.42
const char = (id: string, overrides: Partial<Character> = {}): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  ...overrides,
})
const drafted = (chars = [char('a', { upgrades: { reroll: 1 } })]) =>
  openDrafts(clearRoom(newRunState('r', 'X', chars, []), 'combat'), 'combat', random)

describe('draft choices as data', () => {
  it('take, pass and reroll go through the draft rules', () => {
    expect(applyChoice(drafted(), 'a', { action: 'take', index: 1 }, random).players[0].slots?.[0]).not.toBeNull()
    expect(applyChoice(drafted(), 'a', { action: 'pass' }, random).players[0].quantumBasaltsPassed).toBe(1)
    const rerolled = applyChoice(drafted(), 'a', { action: 'reroll' }, random)
    expect(rerolled.players[0].draft).not.toBeNull()
    expect(rerolled.players[0].rerolls).toEqual({ floor: 1, used: 1 })
  })

  it('hidden choices take or pass the hidden offer', () => {
    const state = roomConditionMet(drafted(), random)
    const gift = state.players[0].hiddenOffer!.gifts[0]
    expect(applyChoice(state, 'a', { action: 'hidden', hiddenBoonId: gift }, random).players[0].hiddenBoonId).toBe(gift)
    expect(applyChoice(state, 'a', { action: 'passHidden' }, random).players[0].hiddenOffer).toBeNull()
  })

  it('invalid choices are refused', () => {
    expect(() => applyChoice(drafted(), 'a', { action: 'take', index: 9 }, random)).toThrow()
    expect(() => applyChoice(drafted(), 'a', { action: 'hidden', hiddenBoonId: 'trapwise' }, random)).toThrow()
  })
})

describe('draft keys', () => {
  it('change when the offer changes, so stale choices can be spotted', () => {
    const state = drafted()
    const before = draftKey(state.players[0])
    expect(before).toBe('1-1-1-0')
    const rerolled = applyChoice(state, 'a', { action: 'reroll' }, random)
    expect(draftKey(rerolled.players[0])).not.toBe(before)
    expect(draftKey(applyChoice(state, 'a', { action: 'pass' }, random).players[0])).toBeNull()
  })
})
