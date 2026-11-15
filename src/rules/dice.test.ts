import { describe, expect, it } from 'vitest'
import type { Random } from './draft'
import { parseDice, rollDice } from './dice'

const queuedRandom = (values: number[]): Random => {
  let index = 0
  return () => {
    if (index >= values.length) {
      throw new Error('Ran out of queued random values')
    }
    return values[index++]
  }
}

describe('parseDice', () => {
  it('parses standard notation, defaults count to 1, and handles uppercase and spaces', () => {
    expect(parseDice('1d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
    expect(parseDice('2d6+3')).toEqual({ count: 2, sides: 6, modifier: 3 })
    expect(parseDice('4d8-1')).toEqual({ count: 4, sides: 8, modifier: -1 })
    expect(parseDice('d20')).toEqual({ count: 1, sides: 20, modifier: 0 })
    expect(parseDice(' 2D6 + 3 ')).toEqual({ count: 2, sides: 6, modifier: 3 })
    expect(parseDice('100d1000-0')).toEqual({ count: 100, sides: 1000, modifier: 0 })
  })

  it('throws an Error including the original input for invalid notation', () => {
    const invalidInputs = [
      '',
      'abc',
      '2d',
      '0d6',
      '101d6',
      '2d0',
      '2d1001',
      '2d6+',
      '2d6+3+1',
      '1.5d6',
      '-1d6',
      '2d6x2',
    ]

    for (const input of invalidInputs) {
      expect(() => parseDice(input)).toThrowError(Error)
      try {
        parseDice(input)
      } catch (err) {
        expect((err as Error).message).toContain(input)
      }
    }
  })
})

describe('rollDice', () => {
  it('rolls 1d20 at minimum and maximum random bounds', () => {
    expect(rollDice('1d20', () => 0)).toEqual({
      notation: '1d20',
      count: 1,
      sides: 20,
      modifier: 0,
      rolls: [1],
      total: 1,
    })

    expect(rollDice('1d20', () => 0.999)).toEqual({
      notation: '1d20',
      count: 1,
      sides: 20,
      modifier: 0,
      rolls: [20],
      total: 20,
    })
  })

  it('sums queued rolls and applies positive modifiers', () => {
    const result = rollDice('2d6+3', queuedRandom([0.2, 0.7]))
    expect(result).toEqual({
      notation: '2d6+3',
      count: 2,
      sides: 6,
      modifier: 3,
      rolls: [2, 5],
      total: 10,
    })
  })

  it('subtracts negative modifiers from the roll total', () => {
    const result = rollDice('4d8-1', queuedRandom([0, 0.25, 0.5, 0.875]))
    expect(result).toEqual({
      notation: '4d8-1',
      count: 4,
      sides: 8,
      modifier: -1,
      rolls: [1, 3, 5, 8],
      total: 16,
    })
  })

  it('handles defaulted count, uppercase, and surrounding/internal spaces', () => {
    expect(rollDice('d20', () => 0.5)).toEqual({
      notation: 'd20',
      count: 1,
      sides: 20,
      modifier: 0,
      rolls: [11],
      total: 11,
    })

    expect(rollDice(' 2D6 + 3 ', queuedRandom([0, 0.99]))).toEqual({
      notation: '2D6 + 3',
      count: 2,
      sides: 6,
      modifier: 3,
      rolls: [1, 6],
      total: 10,
    })
  })

  it('produces count rolls within 1..sides over many rolls with Math.random', () => {
    for (let i = 0; i < 200; i++) {
      const result = rollDice('5d12+2')
      expect(result.rolls).toHaveLength(5)
      for (const r of result.rolls) {
        expect(Number.isInteger(r)).toBe(true)
        expect(r).toBeGreaterThanOrEqual(1)
        expect(r).toBeLessThanOrEqual(12)
      }
      const expectedTotal = result.rolls.reduce((sum, r) => sum + r, 0) + 2
      expect(result.total).toBe(expectedTotal)
    }
  })
})
