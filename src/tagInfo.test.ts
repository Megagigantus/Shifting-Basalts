import { describe, expect, it } from 'vitest'
import { BOONS } from './rules/boons'
import { tagInfo } from './tagInfo'

describe('tagInfo', () => {
  it('has hover text for every tag a boon uses', () => {
    const tags = [...new Set(BOONS.flatMap((b) => b.tags))]
    for (const tag of tags) expect(tagInfo(tag), tag).toMatch(new RegExp(`^${tag}: .+`))
  })

  it('returns undefined for an unknown tag', () => {
    expect(tagInfo('Nonsense')).toBeUndefined()
  })
})
