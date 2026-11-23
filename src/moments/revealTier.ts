import { boon, combination, evolution, hiddenBoon, type Slot } from '../rules/boons'
import type { Offer } from '../rules/draft'
import { THEME, tierRank, type MomentTheme, type RuleWhen } from './theme'

/** Offer classification used by reveal tier rules. */
export type OfferType = 'new' | 'levelUp' | 'evolution' | 'combination' | 'hidden'

/** Presentation card built from a draft offer or hidden boon. */
export interface RevealCard {
  cardKind: 'boon' | 'evolution' | 'combination' | 'hidden'
  id: string
  offerType: OfferType
  fromLevel: number | null
  toLevel: number | null
  sources?: [string, string]
  conditionText: string | null
  tier: string
  accent: string | null
}

/** Input checked against tierRules and accentRules. */
export interface TierInput {
  offerType: OfferType
  source?: string | null
}

function matchesWhen(when: RuleWhen, input: TierInput): boolean {
  if (when.offerType !== undefined && !when.offerType.includes(input.offerType)) return false
  if (when.source !== undefined && (input.source == null || !when.source.includes(input.source))) return false
  return true
}

/** Pick the first matching reveal tier id for an offer, or theme.defaultTier. */
export function tierFor(input: TierInput, theme: MomentTheme = THEME): string {
  const rule = theme.tierRules.find((r) => matchesWhen(r.when, input))
  return rule ? rule.tier : theme.defaultTier
}

/** Pick the first matching reveal accent id for an offer, or null. */
export function accentFor(input: TierInput, theme: MomentTheme = THEME): string | null {
  const rule = theme.accentRules.find((r) => matchesWhen(r.when, input))
  return rule ? rule.accent : null
}

/** Turn a draft offer and the player's current slots into a RevealCard. */
export function cardFromOffer(offer: Offer, slots: Slot[], theme: MomentTheme = THEME): RevealCard {
  if (offer.kind === 'boon') {
    const held = slots.find((s) => s?.kind === 'boon' && s.boonId === offer.boonId)
    const offerType: OfferType = held && held.kind === 'boon' ? 'levelUp' : 'new'
    const fromLevel = held && held.kind === 'boon' ? held.level : null
    const toLevel = fromLevel !== null ? fromLevel + 1 : 1
    const source = boon(offer.boonId).source ?? null
    const input: TierInput = { offerType, source }
    return {
      cardKind: 'boon',
      id: offer.boonId,
      offerType,
      fromLevel,
      toLevel,
      conditionText: null,
      tier: tierFor(input, theme),
      accent: accentFor(input, theme),
    }
  }

  if (offer.kind === 'evolution') {
    const offerType: OfferType = 'evolution'
    const source = evolution(offer.evolutionId).source ?? null
    const input: TierInput = { offerType, source }
    return {
      cardKind: 'evolution',
      id: offer.evolutionId,
      offerType,
      fromLevel: null,
      toLevel: null,
      conditionText: null,
      tier: tierFor(input, theme),
      accent: accentFor(input, theme),
    }
  }

  const offerType: OfferType = 'combination'
  const [first, second] = combination(offer.combinationId).boons
  const input: TierInput = { offerType, source: null }
  return {
    cardKind: 'combination',
    id: offer.combinationId,
    offerType,
    fromLevel: null,
    toLevel: null,
    sources: [first, second],
    conditionText: null,
    tier: tierFor(input, theme),
    accent: accentFor(input, theme),
  }
}

/** Turn a hidden boon id and optional condition text into a RevealCard. */
export function cardFromHidden(
  hiddenBoonId: string,
  conditionText: string | null,
  theme: MomentTheme = THEME,
): RevealCard {
  const offerType: OfferType = 'hidden'
  const source = hiddenBoon(hiddenBoonId).source ?? null
  const input: TierInput = { offerType, source }
  return {
    cardKind: 'hidden',
    id: hiddenBoonId,
    offerType,
    fromLevel: null,
    toLevel: null,
    conditionText: conditionText ?? null,
    tier: tierFor(input, theme),
    accent: accentFor(input, theme),
  }
}

/** Card indices sorted by ascending tier significance, preserving original order on ties. */
export function revealOrder(cards: RevealCard[], theme: MomentTheme = THEME): number[] {
  return cards
    .map((card, index) => ({ index, rank: tierRank(card.tier, theme) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.index)
}
