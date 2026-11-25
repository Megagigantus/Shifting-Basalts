import { describe, expect, it } from 'vitest'
import { hasLoreLaurel } from './useLoreLibrary'

describe('hasLoreLaurel', () => {
  it('returns false when summary is null or total is 0', () => {
    expect(hasLoreLaurel(5, null)).toBe(false)
    expect(hasLoreLaurel(0, { total: 0 })).toBe(false)
    expect(hasLoreLaurel(3, { total: 0 })).toBe(false)
  })

  it('returns false when count is undefined or below total', () => {
    expect(hasLoreLaurel(undefined, { total: 10 })).toBe(false)
    expect(hasLoreLaurel(0, { total: 10 })).toBe(false)
    expect(hasLoreLaurel(9, { total: 10 })).toBe(false)
  })

  it('returns true when count equals or exceeds a positive total', () => {
    expect(hasLoreLaurel(10, { total: 10 })).toBe(true)
    expect(hasLoreLaurel(12, { total: 10 })).toBe(true)
  })
})
