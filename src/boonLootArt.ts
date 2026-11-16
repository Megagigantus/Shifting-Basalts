// Picture lookups for boons, evolutions, combinations, hidden boons, loot
// items and run currencies, with fallbacks when specific art isn't added yet.
import { artUrl, type ArtKind } from './art'
import gearBases from './data/gear-bases.json'
import { boon, combination, evolution, hiddenBoon, type SlotContent } from './rules/boons'
import type { Offer } from './rules/draft'
import { GEAR_ROWS } from './rules/gear'
import type { LootItem } from './rules/loot'

export type ArtLookup = (kind: ArtKind, id: string) => string | null

export type BoonArtRef =
  | { kind: 'boon'; id: string }
  | { kind: 'evolution'; id: string }
  | { kind: 'combination'; id: string }
  | { kind: 'hidden'; id: string }

const ARMOR_IDS = new Set(gearBases.armor.map((a) => a.id))
const SHIELD_ID = 'shield'

/** Turn a boon tag into a file id: lower case, non-alphanumerics to dashes, trimmed. */
export function tagArtId(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function asArray(url: string | null): string[] {
  return url ? [url] : []
}

/** Picture URLs for a boon, evolution, combination or hidden boon, with fallbacks. */
export function boonArt(ref: BoonArtRef, lookup: ArtLookup = artUrl): string[] {
  switch (ref.kind) {
    case 'boon': {
      const b = boon(ref.id)
      const own = lookup('boons', ref.id)
      if (own) return [own]
      const firstTag = b.tags[0]
      return firstTag ? asArray(lookup('boon-tags', tagArtId(firstTag))) : []
    }
    case 'evolution': {
      const evo = evolution(ref.id)
      const own = lookup('evolutions', ref.id)
      if (own) return [own]
      return boonArt({ kind: 'boon', id: evo.from }, lookup)
    }
    case 'combination': {
      const combo = combination(ref.id)
      const own = lookup('combinations', ref.id)
      if (own) return [own]
      return combo.boons.flatMap((id) => boonArt({ kind: 'boon', id }, lookup))
    }
    case 'hidden': {
      hiddenBoon(ref.id)
      const own = lookup('hidden-boons', ref.id)
      if (own) return [own]
      return asArray(lookup('boon-tags', 'hidden'))
    }
  }
}

/** Which picture a filled boon slot shows. */
export function slotArtRef(slot: SlotContent): BoonArtRef {
  if (slot.kind === 'boon') return { kind: 'boon', id: slot.boonId }
  if (slot.kind === 'evolution') return { kind: 'evolution', id: slot.evolutionId }
  return { kind: 'combination', id: slot.combinationId }
}

/** Which picture a draft offer shows: a level-up or new boon shows the boon itself. */
export function offerArtRef(offer: Offer): BoonArtRef {
  if (offer.kind === 'evolution') return { kind: 'evolution', id: offer.evolutionId }
  if (offer.kind === 'combination') return { kind: 'combination', id: offer.combinationId }
  return { kind: 'boon', id: offer.boonId }
}

function gearKindArtId(item: Pick<LootItem, 'ref' | 'base'>): 'gear-shield' | 'gear-armor' | 'gear-weapon' {
  const base = item.base || GEAR_ROWS.find((g) => g.id === item.ref)?.bases[0]
  if (base === SHIELD_ID && ARMOR_IDS.has(base)) return 'gear-shield'
  if (base && ARMOR_IDS.has(base)) return 'gear-armor'
  return 'gear-weapon'
}

/** Picture URL for a loot item, falling back to its kind icon or null. */
export function lootArt(
  item: Pick<LootItem, 'kind' | 'ref' | 'base'>,
  lookup: ArtLookup = artUrl,
): string | null {
  switch (item.kind) {
    case 'relic':
      return lookup('relics', item.ref)
    case 'trinket':
      return lookup('loot-kinds', 'trinket')
    case 'consumable':
      return (
        lookup('loot', item.ref) ??
        (item.ref === 'healing-potion' ? lookup('loot-kinds', 'healing-potion') : null) ??
        lookup('loot-kinds', 'consumable')
      )
    case 'gear':
      return lookup('loot', item.ref) ?? lookup('loot-kinds', gearKindArtId(item))
    case 'wondrous':
      return lookup('loot', item.ref) ?? lookup('loot-kinds', 'wondrous')
    case 'trophy':
      return lookup('loot', item.ref) ?? lookup('loot-kinds', 'trophy')
  }
}

/** Picture URL for a run currency, or null when not yet added. */
export function currencyArt(
  which: 'credits' | 'quantum-basalts',
  lookup: ArtLookup = artUrl,
): string | null {
  return lookup('loot-kinds', which)
}
