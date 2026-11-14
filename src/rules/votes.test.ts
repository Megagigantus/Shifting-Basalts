import { describe, expect, it } from 'vitest'
import type { RunState } from '../model/run'
import { tallyVotes, votingOpen } from './votes'

const state = (overrides: Partial<RunState['run']> = {}): RunState =>
  ({
    run: { status: 'active', awaitingChoice: true, floor: 2, ...overrides },
    players: [
      { characterId: 'a', name: 'Ash', alive: true },
      { characterId: 'b', name: 'Bree', alive: true },
      { characterId: 'c', name: 'Cole', alive: true },
      { characterId: 'd', name: 'Dov', alive: false },
    ],
  }) as unknown as RunState

describe('descend or extract votes', () => {
  it('tallies living players for this floor and lists who has not voted', () => {
    const tally = tallyVotes(state(), {
      a: { vote: 'descend', floor: 2 },
      b: { vote: 'extract', floor: 2 },
      d: { vote: 'extract', floor: 2 }, // fallen: not counted
    })
    expect(tally).toEqual({ descend: ['Ash'], extract: ['Bree'], waiting: ['Cole'] })
  })

  it('ignores votes from an earlier floor', () => {
    expect(tallyVotes(state(), { a: { vote: 'descend', floor: 1 } }).waiting).toEqual(['Ash', 'Bree', 'Cole'])
  })

  it('is only open after a boss below floor 5', () => {
    expect(votingOpen(state())).toBe(true)
    expect(votingOpen(state({ awaitingChoice: false }))).toBe(false)
    expect(votingOpen(state({ floor: 5 }))).toBe(false)
    expect(votingOpen(state({ status: 'extracted' }))).toBe(false)
  })
})
