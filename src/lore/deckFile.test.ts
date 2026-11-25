import { describe, expect, it } from 'vitest'
import { buildDeckExport, buildSummary, validateDeckFile } from './deckFile.ts'
import type { LoreCard, LoreDeckFile, LoreGroup, LoreSettings } from './types.ts'

function makeSettings(overrides: Partial<LoreSettings> = {}): LoreSettings {
  return {
    tierLimit: 'deep',
    deepPerRun: 1,
    anchor: {
      name: 'Relay-7',
      voiceNote: 'Calm, clipped, slightly delayed.',
    },
    ...overrides,
  }
}

function makeGroups(): LoreGroup[] {
  return [
    {
      id: 'arrivals',
      name: 'Arrivals and firsts',
      description: 'First steps onto the basalt stair.',
      defaultImageUrl: null,
      defaultImagePrompt: 'Stone steps descending into dark hexagonal basalt.',
    },
    {
      id: 'relics',
      name: 'Lost relics',
      description: 'Items left behind by earlier visitors.',
      defaultImageUrl: 'art/lore/relics-default.webp',
      defaultImagePrompt: 'Weathered brass trinket resting on a dark column.',
    },
  ]
}

function makeCards(): LoreCard[] {
  return [
    {
      id: 'arr-welcome',
      group: 'arrivals',
      title: 'Welcome, Lantern',
      trigger: { key: 'first-entry', label: 'First entry ever' },
      repeat: 'once_campaign',
      tier: 'open',
      source: 'loremaster',
      readAloud: 'A warm chime rings from the archway as you step inside.',
      push: 'The stone remembers footsteps.',
      dmTruth: 'An old survey marker left by an earlier crew.',
      placeholders: [],
      imagePrompt: 'Glowing archway carved into dark basalt.',
      imageUrl: null,
    },
    {
      id: 'rel-keepsake',
      group: 'relics',
      title: 'Familiar Keepsake',
      trigger: { key: 'oddity-keepsake', label: 'Oddity: lost item' },
      repeat: 'once_campaign',
      tier: 'guarded',
      source: 'canon',
      readAloud: 'Sitting neatly on a pillar is {item}, untouched by dust.',
      push: 'Anything misplaced eventually turns up here.',
      dmTruth: 'Drawn into the vault by the maze keeper.',
      placeholders: ['item'],
      imagePrompt: 'Small personal trinket atop a polished basalt pillar.',
      imageUrl: null,
    },
    {
      id: 'arr-deep-seam',
      group: 'arrivals',
      title: 'The Quiet Seam',
      trigger: { key: 'floor-three', label: 'First arrival on floor 3' },
      repeat: 'once_campaign',
      tier: 'deep',
      source: 'both',
      readAloud: 'Golden light rises from a hairline crack beneath your boots.',
      push: 'The light does not cast shadows upward.',
      dmTruth: 'The fractured core sits two floors below.',
      placeholders: [],
      imagePrompt: 'Golden light seeping upward through cracked hexagonal stone.',
      imageUrl: 'art/lore/arr-deep-seam.webp',
    },
    {
      id: 'rel-dispatch-adhoc',
      group: 'relics',
      title: 'Dispatch: Field Note',
      trigger: { key: 'dispatch-adhoc', label: 'Custom post-boss dispatch' },
      repeat: 'once_campaign',
      tier: 'open',
      source: 'loremaster',
      readAloud: 'Relay-7 crackles: the ledger entry is older than the map.',
      push: 'Further clearance required for full manifest.',
      dmTruth: 'Written mid-run for the party question.',
      placeholders: [],
      imagePrompt: 'Static-laced parchment projection.',
      imageUrl: null,
      adHoc: true,
    },
  ]
}

function makeRawDeck(): LoreDeckFile {
  return {
    schemaVersion: 1,
    deck: 'Test Basalts Deck',
    settings: makeSettings(),
    groups: makeGroups(),
    cards: makeCards(),
  }
}

describe('validateDeckFile', () => {
  it('accepts a valid deck, assigns order 0..n-1, and drops unknown extra keys', () => {
    const raw = {
      ...makeRawDeck(),
      extraRootKey: 'ignored',
      settings: {
        ...makeSettings(),
        extraSetting: 42,
        anchor: {
          ...makeSettings().anchor,
          extraAnchor: true,
        },
      },
      groups: makeGroups().map((g) => ({ ...g, extraGroupKey: 'drop-me' })),
      cards: makeCards().map((c, idx) => ({
        ...c,
        order: 99 - idx,
        extraCardKey: 'drop-me',
      })),
    }

    const result = validateDeckFile(raw, [])
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.deck.cards.map((c) => c.order)).toEqual([0, 1, 2, 3])
    expect(result.deck.cards.map((c) => c.id)).toEqual([
      'arr-welcome',
      'rel-keepsake',
      'arr-deep-seam',
      'rel-dispatch-adhoc',
    ])
    expect('extraRootKey' in result.deck).toBe(false)
    expect('extraSetting' in result.deck.settings).toBe(false)
    expect('extraAnchor' in result.deck.settings.anchor).toBe(false)
    expect('extraGroupKey' in result.deck.groups[0]).toBe(false)
    expect('extraCardKey' in result.deck.cards[0]).toBe(false)
  })

  it('rejects bad schemaVersion', () => {
    const raw = { ...makeRawDeck(), schemaVersion: 2 }
    const result = validateDeckFile(raw, [])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true)
  })

  it('rejects bad tier', () => {
    const raw = makeRawDeck()
    const badCards = raw.cards.map((c, i) =>
      i === 0 ? { ...c, tier: 'secret' } : c,
    )
    const result = validateDeckFile({ ...raw, cards: badCards }, [])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.includes('arr-welcome') && e.includes('tier'))).toBe(true)
  })

  it('rejects duplicate card id', () => {
    const raw = makeRawDeck()
    const dupCards = raw.cards.map((c, i) =>
      i === 2 ? { ...c, id: 'arr-welcome' } : c,
    )
    const result = validateDeckFile({ ...raw, cards: dupCards }, [])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(
      result.errors.some((e) => e.includes('arr-welcome') && e.includes('duplicate')),
    ).toBe(true)
  })

  it('rejects unknown group', () => {
    const raw = makeRawDeck()
    const badCards = raw.cards.map((c, i) =>
      i === 0 ? { ...c, group: 'nonexistent-group' } : c,
    )
    const result = validateDeckFile({ ...raw, cards: badCards }, [])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.includes('arr-welcome') && e.includes('group'))).toBe(true)
  })

  it('rejects placeholder mismatches in both directions', () => {
    const raw = makeRawDeck()
    const unlistedCards = raw.cards.map((c, i) =>
      i === 1 ? { ...c, placeholders: [] } : c,
    )
    const resUnlisted = validateDeckFile({ ...raw, cards: unlistedCards }, [])
    expect(resUnlisted.ok).toBe(false)
    if (!resUnlisted.ok) {
      expect(
        resUnlisted.errors.some(
          (e) => e.includes('rel-keepsake') && e.includes('readAloud') && e.includes('placeholders'),
        ),
      ).toBe(true)
    }

    const extraListedCards = raw.cards.map((c, i) =>
      i === 0 ? { ...c, placeholders: ['item'] } : c,
    )
    const resMissing = validateDeckFile({ ...raw, cards: extraListedCards }, [])
    expect(resMissing.ok).toBe(false)
    if (!resMissing.ok) {
      expect(
        resMissing.errors.some(
          (e) => e.includes('arr-welcome') && e.includes('readAloud') && e.includes('placeholders'),
        ),
      ).toBe(true)
    }
  })

  it('rejects bad id format for groups and cards without leaking contents', () => {
    const raw = makeRawDeck()
    const badGroups = raw.groups.map((g, i) =>
      i === 0 ? { ...g, id: 'Arrivals_Bad' } : g,
    )
    const badCards = raw.cards.map((c, i) =>
      i === 0 ? { ...c, id: 'Bad Card!' } : c,
    )
    const result = validateDeckFile({ ...raw, groups: badGroups, cards: badCards }, [])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.includes('groups[0]') && e.includes('id'))).toBe(true)
    expect(result.errors.some((e) => e.includes('cards[0]') && e.includes('id'))).toBe(true)
    expect(result.errors.join('\n')).not.toContain('A warm chime')
  })

  it('rejects bad deepPerRun values', () => {
    const rawNegative = {
      ...makeRawDeck(),
      settings: makeSettings({ deepPerRun: -1 }),
    }
    const resNeg = validateDeckFile(rawNegative, [])
    expect(resNeg.ok).toBe(false)
    if (!resNeg.ok) {
      expect(resNeg.errors.some((e) => e.includes('deepPerRun'))).toBe(true)
    }

    const rawFloat = {
      ...makeRawDeck(),
      settings: makeSettings({ deepPerRun: 1.5 }),
    }
    const resFloat = validateDeckFile(rawFloat, [])
    expect(resFloat.ok).toBe(false)
    if (!resFloat.ok) {
      expect(resFloat.errors.some((e) => e.includes('deepPerRun'))).toBe(true)
    }
  })

  it('collects and reports all errors across the file instead of stopping at the first', () => {
    const raw = makeRawDeck()
    const broken = {
      ...raw,
      schemaVersion: 99,
      settings: {
        ...makeSettings({ deepPerRun: -2 }),
        tierLimit: 'invalid-tier',
      },
      cards: raw.cards.map((c, i) => {
        if (i === 0) return { ...c, tier: 'bogus', group: 'missing' }
        if (i === 1) return { ...c, placeholders: [] }
        return c
      }),
    }

    const result = validateDeckFile(broken, [])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.length).toBeGreaterThanOrEqual(6)
    expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true)
    expect(result.errors.some((e) => e.includes('settings.tierLimit'))).toBe(true)
    expect(result.errors.some((e) => e.includes('settings.deepPerRun'))).toBe(true)
    expect(result.errors.some((e) => e.includes('arr-welcome') && e.includes('tier'))).toBe(true)
    expect(result.errors.some((e) => e.includes('arr-welcome') && e.includes('group'))).toBe(true)
    expect(result.errors.some((e) => e.includes('rel-keepsake') && e.includes('placeholders'))).toBe(
      true,
    )
  })

  it('fails when a banned term appears in dmTruth while allowing it only in readAloud', () => {
    const raw = makeRawDeck()
    const cleanReadAloudOnly = {
      ...raw,
      cards: raw.cards.map((c, i) =>
        i === 0 ? { ...c, readAloud: 'Travelers whisper of Zorblax by the stair.' } : c,
      ),
    }
    expect(validateDeckFile(cleanReadAloudOnly, ['zorblax']).ok).toBe(true)

    const leakedInTruth = {
      ...raw,
      cards: raw.cards.map((c, i) =>
        i === 0 ? { ...c, dmTruth: 'Secretly linked to Zorblax.' } : c,
      ),
    }
    const failResult = validateDeckFile(leakedInTruth, ['zorblax'])
    expect(failResult.ok).toBe(false)
    if (!failResult.ok) {
      expect(
        failResult.errors.some(
          (e) => e.includes('card arr-welcome') && e.includes('dmTruth'),
        ),
      ).toBe(true)
      expect(failResult.errors.join('\n')).not.toContain('Secretly linked')
    }
  })

  it('fails when a banned term appears in a group description', () => {
    const raw = makeRawDeck()
    const badGroups = raw.groups.map((g, i) =>
      i === 1 ? { ...g, description: 'Relics tied to zorblax.' } : g,
    )
    const result = validateDeckFile({ ...raw, groups: badGroups }, ['zorblax'])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(
      result.errors.some((e) => e.includes('group relics') && e.includes('description')),
    ).toBe(true)
    expect(result.errors.join('\n')).not.toContain('Relics tied')
  })
})

describe('buildDeckExport', () => {
  it('round-trips through validateDeckFile, drops order, and keeps adHoc only when true', () => {
    const settings = makeSettings()
    const groups = makeGroups()
    const cards = makeCards().map((c, idx) => ({
      ...c,
      order: idx,
      adHoc: c.adHoc ?? false,
    }))

    const exported = buildDeckExport(settings, groups, cards, 'Custom Deck')
    expect(exported.schemaVersion).toBe(1)
    expect(exported.deck).toBe('Custom Deck')
    for (const card of exported.cards) {
      expect('order' in card).toBe(false)
      if (card.id === 'rel-dispatch-adhoc') {
        expect(card.adHoc).toBe(true)
      } else {
        expect('adHoc' in card).toBe(false)
      }
    }

    const revalidated = validateDeckFile(exported, [])
    expect(revalidated.ok).toBe(true)
  })

  it('sorts cards by order with unordered cards last sorted by id', () => {
    const cards = makeCards()
    const withMixedOrder: LoreCard[] = [
      { ...cards[3] }, // no order, id: rel-dispatch-adhoc
      { ...cards[2], order: 5 }, // id: arr-deep-seam
      { ...cards[1] }, // no order, id: rel-keepsake
      { ...cards[0], order: 0 }, // id: arr-welcome
    ]

    const exported = buildDeckExport(makeSettings(), makeGroups(), withMixedOrder)
    expect(exported.cards.map((c) => c.id)).toEqual([
      'arr-welcome',
      'arr-deep-seam',
      'rel-dispatch-adhoc',
      'rel-keepsake',
    ])
  })
})

describe('buildSummary', () => {
  it('counts non-adHoc cards per group, computes total, and omits card titles and text', () => {
    const groups = makeGroups()
    const cards = makeCards()

    const summary = buildSummary(groups, cards)
    expect(summary).toEqual({
      groups: [
        { id: 'arrivals', name: 'Arrivals and firsts', count: 2 },
        { id: 'relics', name: 'Lost relics', count: 1 },
      ],
      total: 3,
    })

    const serialized = JSON.stringify(summary)
    for (const card of cards) {
      expect(serialized).not.toContain(card.title)
      expect(serialized).not.toContain(card.readAloud)
      expect(serialized).not.toContain(card.push)
      expect(serialized).not.toContain(card.dmTruth)
    }
  })
})
