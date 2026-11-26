import { describe, expect, it } from 'vitest'
import { artUrl } from '../art'
import { EMBEDDED_LORE_DECK } from './deck'
import { loreImageUrl, loreImageUrlForCard } from './loreArt'

describe('loreImageUrl', () => {
  it('uses boss art for the boss_first_meet:glass-hydra deck card', () => {
    const card = EMBEDDED_LORE_DECK.cards.find(
      (entry) => entry.trigger.key === 'boss_first_meet:glass-hydra',
    )
    expect(card).toBeDefined()
    const expected = artUrl('bosses', 'glass-hydra')
    expect(expected).not.toBeNull()
    expect(loreImageUrl(card!)).toBe(expected)
    expect(loreImageUrlForCard(card!.id, null)).toBe(expected)
  })

  it('uses family art for a family_first_meet:the-lost card', () => {
    const expected = artUrl('families', 'the-lost')
    expect(expected).not.toBeNull()
    expect(
      loreImageUrl({
        id: 'custom-family-card',
        group: 'families',
        trigger: { key: 'family_first_meet:the-lost' },
        imageUrl: 'https://example.com/override.png',
      }),
    ).toBe(expected)
  })

  it('still resolves arr-welcome to lore folder art', () => {
    const card = EMBEDDED_LORE_DECK.cards.find((entry) => entry.id === 'arr-welcome')
    expect(card).toBeDefined()
    const expected = artUrl('lore', 'arr-welcome')
    expect(loreImageUrl(card!)).toBe(expected)
    expect(loreImageUrlForCard('arr-welcome', null)).toBe(expected)
  })

  it('resolves every boss_first_meet and family_first_meet deck card to non-null boss/family art', () => {
    const triggerCards = EMBEDDED_LORE_DECK.cards.filter(
      (card) =>
        card.trigger.key.startsWith('boss_first_meet:') ||
        card.trigger.key.startsWith('family_first_meet:'),
    )
    expect(triggerCards.length).toBeGreaterThan(0)

    for (const card of triggerCards) {
      const group = EMBEDDED_LORE_DECK.groups.find((entry) => entry.id === card.group)
      const isBoss = card.trigger.key.startsWith('boss_first_meet:')
      const kind = isBoss ? 'bosses' : 'families'
      const id = card.trigger.key.slice(
        isBoss ? 'boss_first_meet:'.length : 'family_first_meet:'.length,
      )
      const expected = artUrl(kind, id)
      expect(expected, `${card.id} (${card.trigger.key})`).not.toBeNull()
      expect(loreImageUrl(card, group)).toBe(expected)
    }
  })

  it('falls through to card.imageUrl and group.defaultImageUrl when trigger art is missing', () => {
    expect(
      loreImageUrl(
        {
          id: 'no-such-lore-art',
          group: 'no-such-group',
          trigger: { key: 'boss_first_meet:no-such-boss' },
          imageUrl: 'https://example.com/card.png',
        },
        { defaultImageUrl: 'https://example.com/group.png' },
      ),
    ).toBe('https://example.com/card.png')

    expect(
      loreImageUrl(
        {
          id: 'no-such-lore-art',
          group: 'no-such-group',
          trigger: { key: 'family_first_meet:no-such-family' },
          imageUrl: null,
        },
        { defaultImageUrl: 'https://example.com/group.png' },
      ),
    ).toBe('https://example.com/group.png')

    expect(
      loreImageUrl({
        id: 'no-such-lore-art',
        group: 'no-such-group',
        trigger: { key: 'first_entry' },
        imageUrl: null,
      }),
    ).toBeNull()
  })
})

describe('loreImageUrlForCard', () => {
  it('returns fallback when the card is not in the deck', () => {
    expect(loreImageUrlForCard('no-such-card', 'x')).toBe('x')
    expect(loreImageUrlForCard('no-such-card', null)).toBeNull()
  })
})
