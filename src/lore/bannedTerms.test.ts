import { describe, expect, it } from 'vitest'
import { findBannedInCard, findBannedTerms, parseBannedTerms } from './bannedTerms.ts'
import type { LoreCard } from './types.ts'

function makeCard(overrides: Partial<LoreCard> = {}): LoreCard {
  return {
    id: 'card-1',
    group: 'vault',
    title: 'Stone Echo',
    trigger: { key: 'enter-room', label: 'When entering a basalt chamber' },
    repeat: 'once_run',
    tier: 'guarded',
    source: 'canon',
    readAloud: 'The basalt hums quietly beneath your boots.',
    push: 'If pressed, the carving warms to the touch.',
    dmTruth: 'An ancient survey beacon left by prior explorers.',
    placeholders: ['item', 'floor'],
    imagePrompt: 'Glowing basalt pillar in dark cavern',
    imageUrl: null,
    ...overrides,
  }
}

describe('parseBannedTerms', () => {
  it('handles CRLF, blanks, comments, whitespace, case, and duplicates', () => {
    const input = [
      '# Top-level comment',
      '',
      '   ',
      '  # Indented comment',
      '  Zorblax  ',
      'quuxwort',
      'ZORBLAX',
      '  Quuxwort  ',
      'Flim Flam',
    ].join('\r\n')

    expect(parseBannedTerms(input)).toEqual(['zorblax', 'quuxwort', 'flim flam'])
  })

  it('returns an empty list when input has only comments and blanks', () => {
    expect(parseBannedTerms('\n# comment\r\n   \r\n')).toEqual([])
  })
})

describe('findBannedTerms', () => {
  it('returns an empty list when terms is empty', () => {
    expect(findBannedTerms(makeCard({ title: 'Zorblax' }), [])).toEqual([])
  })

  it('matches substrings case-insensitively and skips specified keys at any depth', () => {
    const value = {
      readAloud: 'zorblax at root',
      nested: {
        readAloud: 'zorblax nested',
        note: 'Contains ZORBLAX inside',
      },
    }

    expect(findBannedTerms(value, ['zorblax'], ['readAloud'])).toEqual([
      { path: 'nested.note', term: 'zorblax' },
    ])
  })
})

describe('findBannedInCard', () => {
  it('reports banned terms across card fields with dotted paths', () => {
    const card = makeCard({
      title: 'The Zorblax Pillar',
      trigger: { key: 'inspect', label: 'Inspecting the zorblax glyph' },
      push: 'Mentions zOrBlAx if pressed',
      dmTruth: 'Secretly powered by Zorblax.',
      placeholders: ['item', 'zorblax-token'],
      imagePrompt: 'A dramatic zorblax silhouette',
    })

    expect(findBannedInCard(card, ['zorblax'])).toEqual([
      { path: 'title', term: 'zorblax' },
      { path: 'trigger.label', term: 'zorblax' },
      { path: 'push', term: 'zorblax' },
      { path: 'dmTruth', term: 'zorblax' },
      { path: 'placeholders.1', term: 'zorblax' },
      { path: 'imagePrompt', term: 'zorblax' },
    ])
  })

  it('flags terms in readAloud too', () => {
    const card = makeCard({
      readAloud: 'The voice whispers of Zorblax in the dark.',
    })

    expect(findBannedInCard(card, ['zorblax'])).toEqual([{ path: 'readAloud', term: 'zorblax' }])
  })

  it('performs case-insensitive matching', () => {
    const card = makeCard({
      dmTruth: 'Hidden reference to QUUXWORT.',
    })

    expect(findBannedInCard(card, ['quuxwort'])).toEqual([
      { path: 'dmTruth', term: 'quuxwort' },
    ])
  })

  it('returns an empty list when terms is empty', () => {
    const card = makeCard({
      dmTruth: 'Zorblax',
      title: 'Zorblax',
    })

    expect(findBannedInCard(card, [])).toEqual([])
  })
})
