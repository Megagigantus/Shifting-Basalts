import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import {
  FORTUNE_TRACK,
  fortuneDiceLeft,
  fortuneDicePerRun,
  setFortuneDice,
  useFortuneDie,
} from './fortune'
import { markDead, newRunState } from './runFlow'

const makeChar = (id: string, trackDevotions: Record<string, number> = {}): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  casterType: 'none',
  trackDevotions,
})

describe('Fortune Dice pools', () => {
  it('fortuneDicePerRun derives dice from Fortune Dice track rank and effect data', () => {
    expect(fortuneDicePerRun({})).toBe(0)
    expect(fortuneDicePerRun({ [FORTUNE_TRACK]: 0 })).toBe(0)
    expect(fortuneDicePerRun({ [FORTUNE_TRACK]: 12 })).toBe(0) // rank 4 -> 0
    expect(fortuneDicePerRun({ [FORTUNE_TRACK]: 15 })).toBe(1) // rank 5 -> 1
    expect(fortuneDicePerRun({ [FORTUNE_TRACK]: 45 })).toBe(2) // rank 10 -> 2
  })

  it('newRunState sets each player fortuneDice from their Fortune Dice track Devotions', () => {
    const none = makeChar('None', {})
    const rank4 = makeChar('Rank4', { [FORTUNE_TRACK]: 12 })
    const rank5 = makeChar('Rank5', { [FORTUNE_TRACK]: 15 })
    const rank10 = makeChar('Rank10', { [FORTUNE_TRACK]: 45 })
    const state = newRunState('r', 'X', [none, rank4, rank5, rank10], [])

    expect(state.players[0].fortuneDice).toBe(0)
    expect(fortuneDiceLeft(state.players[0])).toBe(0)
    expect(state.players[1].fortuneDice).toBe(0)
    expect(state.players[2].fortuneDice).toBe(1)
    expect(fortuneDiceLeft(state.players[2])).toBe(1)
    expect(state.players[3].fortuneDice).toBe(2)
    expect(fortuneDiceLeft(state.players[3])).toBe(2)
    expect(fortuneDiceLeft({})).toBe(0)
  })

  it('useFortuneDie lowers the player count by 1 and leaves other players unchanged', () => {
    const kael = makeChar('Kael', { [FORTUNE_TRACK]: 45 })
    const wren = makeChar('Wren', { [FORTUNE_TRACK]: 15 })
    let state = newRunState('r', 'X', [kael, wren], [])

    state = useFortuneDie(state, 'Kael')
    expect(fortuneDiceLeft(state.players[0])).toBe(1)
    expect(fortuneDiceLeft(state.players[1])).toBe(1)

    state = useFortuneDie(state, 'Kael')
    expect(fortuneDiceLeft(state.players[0])).toBe(0)
    expect(fortuneDiceLeft(state.players[1])).toBe(1)
  })

  it('useFortuneDie throws at 0, for a fallen player, and when the run is not active', () => {
    const kael = makeChar('Kael', { [FORTUNE_TRACK]: 15 })
    const wren = makeChar('Wren', {})
    let state = newRunState('r', 'X', [kael, wren], [])

    expect(() => useFortuneDie(state, 'Wren')).toThrow('Wren has no Fortune Dice left.')

    state = markDead(state, 'Kael', () => 1)
    expect(() => useFortuneDie(state, 'Kael')).toThrow('Kael has fallen.')

    // Fallen Wren wipes the run.
    state = markDead(state, 'Wren', () => 1)
    expect(state.run.status).toBe('wiped')
    expect(() => useFortuneDie(state, 'Kael')).toThrow('This run has ended.')
  })

  it('setFortuneDice sets the count (including for fallen players) and rejects invalid values', () => {
    const kael = makeChar('Kael', {})
    const wren = makeChar('Wren', { [FORTUNE_TRACK]: 15 })
    let state = newRunState('r', 'X', [kael, wren], [])

    state = setFortuneDice(state, 'Kael', 3)
    expect(fortuneDiceLeft(state.players[0])).toBe(3)
    expect(fortuneDiceLeft(state.players[1])).toBe(1)

    state = setFortuneDice(state, 'Kael', 0)
    expect(fortuneDiceLeft(state.players[0])).toBe(0)

    expect(() => setFortuneDice(state, 'Kael', -1)).toThrow(
      'Fortune Dice must be a whole number of 0 or more.',
    )
    expect(() => setFortuneDice(state, 'Kael', 1.5)).toThrow(
      'Fortune Dice must be a whole number of 0 or more.',
    )

    state = markDead(state, 'Kael', () => 1)
    state = setFortuneDice(state, 'Kael', 2)
    expect(fortuneDiceLeft(state.players[0])).toBe(2)

    state = markDead(state, 'Wren', () => 1)
    expect(() => setFortuneDice(state, 'Kael', 1)).toThrow('This run has ended.')
  })
})
