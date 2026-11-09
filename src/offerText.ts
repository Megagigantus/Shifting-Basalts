// Plain-language wording for draft offers, shared by the DM and player screens.
import { boon, combination, evolution, hiddenBoon, slotName, type Slot } from './rules/boons'
import type { Offer } from './rules/draft'

export interface OfferText {
  /** Short label, e.g. "Level up", "New boon", "Wildcard". */
  label: string
  heading: string
  tag?: string
  /** Rules text the player would gain. */
  text: string
  /** True if taking it needs a free slot (a brand-new boon). */
  needsSlot: boolean
}

export function describeOffer(offer: Offer, slots: Slot[]): OfferText {
  if (offer.kind === 'evolution') {
    const evo = evolution(offer.evolutionId)
    const from = slots[offer.slotIndex]
    return {
      label: 'Wildcard: Evolution',
      heading: `Evolve ${from ? slotName(from) : 'a boon'} into ${evo.name}`,
      text: evo.effect,
      needsSlot: false,
    }
  }
  if (offer.kind === 'combination') {
    const combo = combination(offer.combinationId)
    return {
      label: 'Wildcard: Combination',
      heading: `Combine ${combo.boons.map((id) => boon(id).name).join(' + ')} into ${combo.name}`,
      text: `${combo.effect} (Frees up a slot.)`,
      needsSlot: false,
    }
  }
  const b = boon(offer.boonId)
  const held = slots.find((s) => s?.kind === 'boon' && s.boonId === b.id)
  if (held && held.kind === 'boon') {
    return {
      label: 'Level up',
      heading: `${b.name} to Level ${held.level + 1}`,
      tag: b.tags[0],
      text: b.levels[held.level],
      needsSlot: false,
    }
  }
  return {
    label: offer.source === 'wildcard' ? 'Wildcard: new boon' : 'New boon',
    heading: b.name,
    tag: b.tags[0],
    text: `Level 1: ${b.levels[0]}`,
    needsSlot: true,
  }
}

export function describeHidden(id: string): { heading: string; text: string } {
  const h = hiddenBoon(id)
  return { heading: h.name, text: h.effect }
}
