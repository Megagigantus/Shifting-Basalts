// Tests for boon, evolution, combination, hidden boon, loot and currency art lookups and fallback order.
import { describe, expect, it } from 'vitest'
import { boonArt, currencyArt, lootArt, slotArtRef, tagArtId, type ArtLookup } from './boonLootArt'

function fakeLookup(keys: string[]): ArtLookup {
  const available = new Set(keys)
  return (kind, id) => {
    const key = `${kind}/${id}`
    return available.has(key) ? `url:${key}` : null
  }
}

describe('tagArtId', () => {
  it('turns boon tags into lowercase dashed file ids', () => {
    expect(tagArtId('Echo')).toBe('echo')
    expect(tagArtId('  Echo & Guard! ')).toBe('echo-guard')
  })
})

describe('boonArt', () => {
  it('returns own boon art over tag fallback', () => {
    const lookup = fakeLookup(['boons/traverts-echoes', 'boon-tags/echo'])
    expect(boonArt({ kind: 'boon', id: 'traverts-echoes' }, lookup)).toEqual(['url:boons/traverts-echoes'])
  })

  it('falls back to the first tag art when boon art is missing', () => {
    const lookup = fakeLookup(['boon-tags/echo'])
    expect(boonArt({ kind: 'boon', id: 'traverts-echoes' }, lookup)).toEqual(['url:boon-tags/echo'])
  })

  it('returns empty when neither boon nor tag art exists', () => {
    expect(boonArt({ kind: 'boon', id: 'traverts-echoes' }, fakeLookup([]))).toEqual([])
  })

  it('throws on unknown boon ids', () => {
    expect(() => boonArt({ kind: 'boon', id: 'no-such-boon' }, fakeLookup([]))).toThrow()
  })

  it('prefers evolution art, then source boon art, then source boon tag art', () => {
    const full = fakeLookup(['evolutions/chain-of-echoes', 'boons/traverts-echoes', 'boon-tags/echo'])
    expect(boonArt({ kind: 'evolution', id: 'chain-of-echoes' }, full)).toEqual(['url:evolutions/chain-of-echoes'])

    const fromBoon = fakeLookup(['boons/traverts-echoes', 'boon-tags/echo'])
    expect(boonArt({ kind: 'evolution', id: 'chain-of-echoes' }, fromBoon)).toEqual(['url:boons/traverts-echoes'])

    const fromTag = fakeLookup(['boon-tags/echo'])
    expect(boonArt({ kind: 'evolution', id: 'chain-of-echoes' }, fromTag)).toEqual(['url:boon-tags/echo'])

    expect(boonArt({ kind: 'evolution', id: 'chain-of-echoes' }, fakeLookup([]))).toEqual([])
  })

  it('throws on unknown evolution ids', () => {
    expect(() => boonArt({ kind: 'evolution', id: 'no-such-evo' }, fakeLookup([]))).toThrow()
  })

  it('prefers combination art, then both boons in data order, or returns empty when neither exists', () => {
    // shooting-gallery combines elemains-flight-of-fancy (Volley) and traverts-echoes (Echo)
    const ownWins = fakeLookup([
      'combinations/shooting-gallery',
      'boons/elemains-flight-of-fancy',
      'boons/traverts-echoes',
    ])
    expect(boonArt({ kind: 'combination', id: 'shooting-gallery' }, ownWins)).toEqual([
      'url:combinations/shooting-gallery',
    ])

    const bothBoons = fakeLookup(['boons/elemains-flight-of-fancy', 'boon-tags/echo'])
    expect(boonArt({ kind: 'combination', id: 'shooting-gallery' }, bothBoons)).toEqual([
      'url:boons/elemains-flight-of-fancy',
      'url:boon-tags/echo',
    ])

    const oneBoonOnly = fakeLookup(['boons/traverts-echoes'])
    expect(boonArt({ kind: 'combination', id: 'shooting-gallery' }, oneBoonOnly)).toEqual(['url:boons/traverts-echoes'])

    expect(boonArt({ kind: 'combination', id: 'shooting-gallery' }, fakeLookup([]))).toEqual([])
  })

  it('throws on unknown combination ids', () => {
    expect(() => boonArt({ kind: 'combination', id: 'no-such-combo' }, fakeLookup([]))).toThrow()
  })

  it('prefers hidden boon art over the hidden tag fallback', () => {
    const ownWins = fakeLookup(['hidden-boons/unbroken', 'boon-tags/hidden'])
    expect(boonArt({ kind: 'hidden', id: 'unbroken' }, ownWins)).toEqual(['url:hidden-boons/unbroken'])

    const fallback = fakeLookup(['boon-tags/hidden'])
    expect(boonArt({ kind: 'hidden', id: 'unbroken' }, fallback)).toEqual(['url:boon-tags/hidden'])

    expect(boonArt({ kind: 'hidden', id: 'unbroken' }, fakeLookup([]))).toEqual([])
  })

  it('throws on unknown hidden boon ids', () => {
    expect(() => boonArt({ kind: 'hidden', id: 'no-such-hidden' }, fakeLookup([]))).toThrow()
  })
})

describe('lootArt', () => {
  it('looks up relics in relics/', () => {
    const lookup = fakeLookup(['relics/travert-tuning-gauntlet', 'loot/travert-tuning-gauntlet'])
    expect(lootArt({ kind: 'relic', ref: 'travert-tuning-gauntlet' }, lookup)).toBe(
      'url:relics/travert-tuning-gauntlet',
    )
    expect(lootArt({ kind: 'relic', ref: 'travert-tuning-gauntlet' }, fakeLookup([]))).toBeNull()
  })

  it('looks up trinkets only in loot-kinds/trinket', () => {
    const lookup = fakeLookup(['loot/0', 'loot-kinds/trinket'])
    expect(lootArt({ kind: 'trinket', ref: '0' }, lookup)).toBe('url:loot-kinds/trinket')
    expect(lootArt({ kind: 'trinket', ref: '0' }, fakeLookup([]))).toBeNull()
  })

  it('resolves consumables with healing-potion fallback before generic consumable', () => {
    const potionOwn = fakeLookup(['loot/healing-potion', 'loot-kinds/healing-potion', 'loot-kinds/consumable'])
    expect(lootArt({ kind: 'consumable', ref: 'healing-potion' }, potionOwn)).toBe('url:loot/healing-potion')

    const potionKind = fakeLookup(['loot-kinds/healing-potion', 'loot-kinds/consumable'])
    expect(lootArt({ kind: 'consumable', ref: 'healing-potion' }, potionKind)).toBe('url:loot-kinds/healing-potion')

    const potionGeneric = fakeLookup(['loot-kinds/consumable'])
    expect(lootArt({ kind: 'consumable', ref: 'healing-potion' }, potionGeneric)).toBe('url:loot-kinds/consumable')

    const otherOwn = fakeLookup(['loot/pilgrims-wax', 'loot-kinds/consumable'])
    expect(lootArt({ kind: 'consumable', ref: 'pilgrims-wax' }, otherOwn)).toBe('url:loot/pilgrims-wax')

    const otherFallback = fakeLookup(['loot-kinds/consumable', 'loot-kinds/healing-potion'])
    expect(lootArt({ kind: 'consumable', ref: 'pilgrims-wax' }, otherFallback)).toBe('url:loot-kinds/consumable')

    expect(lootArt({ kind: 'consumable', ref: 'pilgrims-wax' }, fakeLookup([]))).toBeNull()
  })

  it('resolves gear own art first, then weapon/armor/shield kind icons from item base or first row base', () => {
    const kindIcons = fakeLookup(['loot-kinds/gear-weapon', 'loot-kinds/gear-armor', 'loot-kinds/gear-shield'])

    const ownWins = fakeLookup(['loot/lodge-hunting-blade', 'loot-kinds/gear-weapon'])
    expect(lootArt({ kind: 'gear', ref: 'lodge-hunting-blade', base: 'dagger' }, ownWins)).toBe(
      'url:loot/lodge-hunting-blade',
    )

    // Explicit bases
    expect(lootArt({ kind: 'gear', ref: 'lodge-hunting-blade', base: 'shortsword' }, kindIcons)).toBe(
      'url:loot-kinds/gear-weapon',
    )
    expect(lootArt({ kind: 'gear', ref: 'wardstone-plate', base: 'plate' }, kindIcons)).toBe(
      'url:loot-kinds/gear-armor',
    )
    expect(lootArt({ kind: 'gear', ref: 'choir-shield', base: 'shield' }, kindIcons)).toBe(
      'url:loot-kinds/gear-shield',
    )

    // Missing base falls back to first base in loot-items.json
    expect(lootArt({ kind: 'gear', ref: 'lodge-hunting-blade' }, kindIcons)).toBe('url:loot-kinds/gear-weapon')
    expect(lootArt({ kind: 'gear', ref: 'wardstone-plate' }, kindIcons)).toBe('url:loot-kinds/gear-armor')
    expect(lootArt({ kind: 'gear', ref: 'choir-shield' }, kindIcons)).toBe('url:loot-kinds/gear-shield')

    expect(lootArt({ kind: 'gear', ref: 'choir-shield', base: 'shield' }, fakeLookup([]))).toBeNull()
  })

  it('resolves wondrous items and trophies with kind fallbacks', () => {
    const wondrousOwn = fakeLookup(['loot/wayward-compass', 'loot-kinds/wondrous'])
    expect(lootArt({ kind: 'wondrous', ref: 'wayward-compass' }, wondrousOwn)).toBe('url:loot/wayward-compass')
    expect(lootArt({ kind: 'wondrous', ref: 'wayward-compass' }, fakeLookup(['loot-kinds/wondrous']))).toBe(
      'url:loot-kinds/wondrous',
    )
    expect(lootArt({ kind: 'wondrous', ref: 'wayward-compass' }, fakeLookup([]))).toBeNull()

    const trophyOwn = fakeLookup(['loot/wardens-cracked-lens', 'loot-kinds/trophy'])
    expect(lootArt({ kind: 'trophy', ref: 'wardens-cracked-lens' }, trophyOwn)).toBe(
      'url:loot/wardens-cracked-lens',
    )
    expect(lootArt({ kind: 'trophy', ref: 'wardens-cracked-lens' }, fakeLookup(['loot-kinds/trophy']))).toBe(
      'url:loot-kinds/trophy',
    )
    expect(lootArt({ kind: 'trophy', ref: 'wardens-cracked-lens' }, fakeLookup([]))).toBeNull()
  })
})

describe('currencyArt', () => {
  it('looks up credits and quantum-basalts in loot-kinds/', () => {
    const lookup = fakeLookup(['loot-kinds/credits', 'loot-kinds/quantum-basalts'])
    expect(currencyArt('credits', lookup)).toBe('url:loot-kinds/credits')
    expect(currencyArt('quantum-basalts', lookup)).toBe('url:loot-kinds/quantum-basalts')
    expect(currencyArt('credits', fakeLookup([]))).toBeNull()
  })
})

describe('slotArtRef', () => {
  it('points each slot kind at its own picture', () => {
    expect(slotArtRef({ kind: 'boon', boonId: 'traverts-echoes', level: 2 })).toEqual({ kind: 'boon', id: 'traverts-echoes' })
    expect(slotArtRef({ kind: 'evolution', evolutionId: 'chain-of-echoes' })).toEqual({ kind: 'evolution', id: 'chain-of-echoes' })
    expect(slotArtRef({ kind: 'combination', combinationId: 'shooting-gallery' })).toEqual({ kind: 'combination', id: 'shooting-gallery' })
  })
})
