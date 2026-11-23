import { boonArt } from '../../boonLootArt'
import { boon, combination, emptySlots, evolution, hiddenBoon, type Slot } from '../../rules/boons'
import type { SampleContext } from '../moduleTypes'
import { cardFromHidden, cardFromOffer, revealOrder, type RevealCard } from '../revealTier'
import { accentById, THEME, tierById, type MomentTheme } from '../theme'
import type { NewMoment } from '../types'

/** Trigger context for a synchronized boon reveal moment. */
export type BoonRevealKind = 'draft' | 'hidden' | 'forge'

/** Firestore-safe payload for a boon reveal moment (uses null, never undefined). */
export interface BoonRevealPayload {
  kind: BoonRevealKind
  offers: Record<string, RevealCard[]>
  names: Record<string, string>
  conditionText: string | null
  partyWide: boolean
}

/** Formatted display strings for a single reveal card. */
export interface CardText {
  name: string
  label: string
  detail: string | null
}

/** Return the first character hand from `characterIds` that has at least one card, or null. */
export function cardsForViewer(
  payload: BoonRevealPayload,
  characterIds: string[],
): { characterId: string; cards: RevealCard[] } | null {
  for (const characterId of characterIds) {
    const cards = payload.offers[characterId]
    if (cards && cards.length > 0) {
      return { characterId, cards }
    }
  }
  return null
}

/** Build the card's display name, tier label (with level tick for Deepened), and detail line. */
export function cardText(card: RevealCard): CardText {
  const tierLabel = tierById(card.tier).label
  const label =
    card.fromLevel !== null && card.toLevel !== null
      ? `${tierLabel} · Level ${card.fromLevel} → ${card.toLevel}`
      : tierLabel

  switch (card.cardKind) {
    case 'boon':
      return {
        name: boon(card.id).name,
        label,
        detail: null,
      }
    case 'evolution': {
      const evo = evolution(card.id)
      return {
        name: evo.name,
        label,
        detail: `from ${boon(evo.from).name}`,
      }
    }
    case 'combination': {
      const combo = combination(card.id)
      const [first, second] = card.sources ?? combo.boons
      return {
        name: combo.name,
        label,
        detail: `${boon(first).name} + ${boon(second).name}`,
      }
    }
    case 'hidden':
      return {
        name: hiddenBoon(card.id).name,
        label,
        detail: card.conditionText ?? null,
      }
  }
}

/** Total reveal animation duration in milliseconds for one player's hand. */
export function revealDurationMs(
  cards: RevealCard[],
  reducedMotion = false,
  theme: MomentTheme = THEME,
): number {
  void reducedMotion
  const { backdropFadeMs, dealMs, dealStaggerMs, flipMs, settleMs, fadeOutMs } = theme.timings
  if (cards.length === 0) {
    return backdropFadeMs + fadeOutMs
  }
  let flipsMs = 0
  for (const card of cards) {
    flipsMs += tierById(card.tier, theme).hesitationMs + flipMs
  }
  return (
    backdropFadeMs +
    dealMs +
    dealStaggerMs * (cards.length - 1) +
    flipsMs +
    settleMs +
    fadeOutMs
  )
}

/** Longest reveal duration across all character hands in the payload. */
export function revealEstimateMs(payload: BoonRevealPayload): number {
  const hands = Object.values(payload.offers)
  if (hands.length === 0) {
    return revealDurationMs([])
  }
  let longest = 0
  for (const cards of hands) {
    const duration = revealDurationMs(cards)
    if (duration > longest) longest = duration
  }
  return longest
}

/** Unique sound keys and image URLs required to play the reveal for the given viewer characters. */
export function revealAssets(
  payload: BoonRevealPayload,
  characterIds: string[],
): { sounds: string[]; images: string[] } {
  const hand = cardsForViewer(payload, characterIds)
  if (!hand) {
    return { sounds: [], images: [] }
  }

  const sounds = new Set<string>(['dim', 'deal'])
  const images = new Set<string>()

  for (const card of hand.cards) {
    sounds.add(tierById(card.tier).soundKey)
    if (card.accent) {
      sounds.add(accentById(card.accent).soundKey)
    }
    for (const url of boonArt({ kind: card.cardKind, id: card.id })) {
      images.add(url)
    }
    if (card.cardKind === 'combination') {
      const sourceIds = card.sources ?? combination(card.id).boons
      for (const sourceId of sourceIds) {
        for (const url of boonArt({ kind: 'boon', id: sourceId })) {
          images.add(url)
        }
      }
    }
  }

  return {
    sounds: [...sounds],
    images: [...images],
  }
}

/** One-line DM status summary describing who is seeing this boon reveal. */
export function describeReveal(payload: BoonRevealPayload, names: Record<string, string>): string {
  const entries = Object.entries(payload.offers).filter(([, cards]) => cards.length > 0)
  const count = entries.length
  const nameFor = (id: string) => payload.names[id] || names[id] || 'a player'

  if (payload.partyWide) {
    if (count === 1) return `Secret condition met: hidden offers for ${nameFor(entries[0]![0])}`
    if (count > 1) return `Secret condition met: hidden offers for ${count} players`
    return 'Secret condition met: hidden offers'
  }

  if (payload.kind === 'forge') {
    if (count === 1) {
      const [charId, cards] = entries[0]!
      const order = revealOrder(cards)
      const topCard = cards[order[order.length - 1]!]!
      const tierLabel = tierById(topCard.tier).label
      return `Forge: ${tierLabel} for ${nameFor(charId)}`
    }
    if (count > 1) return `Forge reveal for ${count} players`
    return 'Forge reveal'
  }

  if (payload.kind === 'hidden') {
    if (count === 1) return `Hidden offer for ${nameFor(entries[0]![0])}`
    if (count > 1) return `Hidden offers for ${count} players`
    return 'Hidden offer'
  }

  if (count === 1) return `Boon reveal for ${nameFor(entries[0]![0])}`
  if (count > 1) return `Boon reveal for ${count} players`
  return 'Boon reveal'
}

function sampleTargets(ctx: SampleContext): { ids: string[]; names: Record<string, string> } {
  const ids = ctx.characterIds.length > 0 ? ctx.characterIds : ['sample']
  const names: Record<string, string> = {}
  for (const id of ids) {
    names[id] = ctx.names[id] ?? (id === 'sample' ? 'Sample Strider' : id)
  }
  return { ids, names }
}

function buildSampleMoment(
  ctx: SampleContext,
  buildCards: () => RevealCard[],
): NewMoment<BoonRevealPayload> {
  const { ids, names } = sampleTargets(ctx)
  const cards = buildCards()
  const offers: Record<string, RevealCard[]> = {}
  for (const id of ids) {
    offers[id] = cards.map((card) => ({ ...card }))
  }
  return {
    type: 'boonReveal',
    audience: { players: 'all', table: true },
    payload: {
      kind: 'draft',
      offers,
      names,
      conditionText: null,
      partyWide: false,
    },
  }
}

/** Sample moment showcasing all five reveal tiers in one hand. */
export function sampleRevealAllTiers(ctx: SampleContext): NewMoment<BoonRevealPayload> {
  return buildSampleMoment(ctx, () => {
    const level2Slots: Slot[] = [{ kind: 'boon', boonId: 'crits-are-for-suckers', level: 2 }, null, null]
    const evoSlots: Slot[] = [{ kind: 'boon', boonId: 'ulmas-thread', level: 3 }, null, null]
    return [
      cardFromOffer({ kind: 'boon', boonId: 'critical-delight', source: 'weighted' }, emptySlots(3)),
      cardFromOffer({ kind: 'boon', boonId: 'crits-are-for-suckers', source: 'held' }, level2Slots),
      cardFromOffer({ kind: 'combination', combinationId: 'super-normal', source: 'wildcard' }, emptySlots(3)),
      cardFromOffer({ kind: 'evolution', evolutionId: 'ball-of-yarn', slotIndex: 0, source: 'wildcard' }, evoSlots),
      cardFromHidden('unbroken', 'Hit with every attack you made in a room.'),
    ]
  })
}

/** Sample moment showcasing the Thils accent layered on three reveal tiers. */
export function sampleRevealThils(ctx: SampleContext): NewMoment<BoonRevealPayload> {
  return buildSampleMoment(ctx, () => {
    const thilsEvoSlots: Slot[] = [{ kind: 'boon', boonId: 'thilss-favor', level: 3 }, null, null]
    return [
      cardFromOffer({ kind: 'boon', boonId: 'thilss-favor', source: 'weighted' }, emptySlots(3)),
      cardFromOffer({ kind: 'evolution', evolutionId: 'thilss-maze', slotIndex: 0, source: 'wildcard' }, thilsEvoSlots),
      cardFromHidden('thilss-wink', 'An enemy was killed by terrain.'),
    ]
  })
}
