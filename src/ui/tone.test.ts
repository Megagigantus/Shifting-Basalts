import { describe, expect, it } from 'vitest'
import { cx, initials, TONES, toneClasses } from './tone'

describe('tones', () => {
  it('gives every tone a full set of classes', () => {
    for (const tone of TONES) {
      const c = toneClasses[tone]
      expect(c.pill).toBeTruthy()
      expect(c.border).toBeTruthy()
      expect(c.text).toBeTruthy()
      expect(c.button).toBeTruthy()
    }
    expect(Object.keys(toneClasses).sort()).toEqual([...TONES].sort())
  })
})

describe('initials', () => {
  it('takes up to two capital letters', () => {
    expect(initials('Corner Bull')).toBe('CB')
    expect(initials('hexling')).toBe('H')
    expect(initials('The Glass Hydra')).toBe('TG')
    expect(initials("Thils's Vault")).toBe('TV')
  })

  it('falls back to a question mark', () => {
    expect(initials('')).toBe('?')
    expect(initials(' -- ')).toBe('?')
  })
})

describe('cx', () => {
  it('skips empty parts', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b')
  })
})
