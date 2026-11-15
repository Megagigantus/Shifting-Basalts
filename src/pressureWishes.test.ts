import { describe, expect, it } from 'vitest'
import { wishTally } from './pressureWishes'

describe('Pressure wishes', () => {
  it('counts only the entering characters, by name', () => {
    const wishes = { a: ['narrow-seam', 'brittle-ground'], b: ['narrow-seam'], c: ['heavy-crown'] }
    const party = [
      { id: 'a', name: 'Ash' },
      { id: 'b', name: 'Bree' },
    ]
    expect(wishTally(wishes, party)).toEqual({ 'narrow-seam': ['Ash', 'Bree'], 'brittle-ground': ['Ash'] })
  })
})
