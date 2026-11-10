import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import { removeCounter, setCounter } from './counters'
import { extract, newRunState } from './runFlow'

const char = (id: string): Character => ({ ...emptyProfile(), ...emptyDungeonLayer(), id, name: id, level: 5 })
const start = () => newRunState('r', 'X', [char('a'), char('b')], [])

describe('boon counters', () => {
  it('add, change and remove named counters per player', () => {
    let state = setCounter(start(), 'a', '  Banked echoes ', 2)
    state = setCounter(state, 'a', 'Banked echoes', 3)
    state = setCounter(state, 'a', 'Reaper chain jumps', 1)
    expect(state.players[0].counters).toEqual({ 'Banked echoes': 3, 'Reaper chain jumps': 1 })
    expect(state.players[1].counters).toEqual({})
    state = removeCounter(state, 'a', 'Banked echoes')
    expect(state.players[0].counters).toEqual({ 'Reaper chain jumps': 1 })
  })

  it('refuse blank names, negative or fractional values, and unknown characters', () => {
    expect(() => setCounter(start(), 'a', ' ', 1)).toThrow('name')
    expect(() => setCounter(start(), 'a', 'Echoes', -1)).toThrow('whole numbers')
    expect(() => setCounter(start(), 'a', 'Echoes', 1.5)).toThrow('whole numbers')
    expect(() => setCounter(start(), 'z', 'Echoes', 1)).toThrow('isn\'t in this run')
  })

  it('stop once the run has ended', () => {
    let state = start()
    state = { ...state, run: { ...state.run, lastBossFloor: 1, awaitingChoice: true } }
    expect(() => setCounter(extract(state), 'a', 'Echoes', 1)).toThrow('ended')
  })
})
