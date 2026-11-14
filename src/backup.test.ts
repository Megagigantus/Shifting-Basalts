import { describe, expect, it } from 'vitest'
import { backupFileName, toPlain } from './backup'

describe('toPlain', () => {
  it('turns timestamps into ISO strings, deep inside objects and arrays', () => {
    const stamp = { toDate: () => new Date('2026-11-14T10:00:00Z') }
    expect(toPlain({ a: 1, when: stamp, list: [stamp, { nested: stamp }], none: null })).toEqual({
      a: 1,
      when: '2026-11-14T10:00:00.000Z',
      list: ['2026-11-14T10:00:00.000Z', { nested: '2026-11-14T10:00:00.000Z' }],
      none: null,
    })
  })

  it('leaves plain values alone', () => {
    expect(toPlain('x')).toBe('x')
    expect(toPlain(3)).toBe(3)
    expect(toPlain([1, 'a', true])).toEqual([1, 'a', true])
  })
})

describe('backupFileName', () => {
  it('uses the local date', () => {
    expect(backupFileName(new Date(2026, 10, 4))).toBe('shifting-basalts-backup-2026-11-04.json')
  })
})
