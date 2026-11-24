import type { RunPlayer, RunState } from '../../model/run'
import { hiddenBoon, type Slot, type SlotContent } from '../../rules/boons'
import { conditionOf } from '../../rules/rooms'
import { cardFromHidden, cardFromOffer, type RevealCard } from '../revealTier'
import type { NewMoment } from '../types'
import type { BoonRevealPayload } from './payload'

function draftMoment(
  prevById: Map<string, RunPlayer>,
  next: RunState,
  names: Record<string, string>,
): NewMoment<BoonRevealPayload> | null {
  const offers: Record<string, RevealCard[]> = {}
  const players: string[] = []

  for (const player of next.players) {
    if (!player.draft || player.draft.starting) continue
    if (prevById.get(player.characterId)?.draft) continue
    const slots = player.slots ?? []
    const cards = player.draft.offers.map((offer) => cardFromOffer(offer, slots))
    if (cards.length === 0) continue
    offers[player.characterId] = cards
    players.push(player.characterId)
  }

  if (players.length === 0) return null
  return {
    type: 'boonReveal',
    audience: { players, table: true },
    payload: {
      kind: 'draft',
      offers,
      names,
      conditionText: null,
      partyWide: false,
    },
  }
}

function hiddenMoment(
  prevById: Map<string, RunPlayer>,
  next: RunState,
  names: Record<string, string>,
): NewMoment<BoonRevealPayload> | null {
  const offers: Record<string, RevealCard[]> = {}
  const players: string[] = []
  let partyWide = false
  let conditionText: string | null = null

  for (const player of next.players) {
    const hiddenOffer = player.hiddenOffer
    if (!hiddenOffer) continue
    const prevOffer = prevById.get(player.characterId)?.hiddenOffer
    const prevIds = new Set<string>([
      ...(prevOffer?.classBoon ? [prevOffer.classBoon] : []),
      ...(prevOffer?.gifts ?? []),
    ])

    const cards: RevealCard[] = []
    if (hiddenOffer.classBoon && !prevIds.has(hiddenOffer.classBoon)) {
      const boonCondition = hiddenBoon(hiddenOffer.classBoon).condition ?? null
      cards.push(cardFromHidden(hiddenOffer.classBoon, boonCondition))
    }

    for (const giftId of hiddenOffer.gifts) {
      if (prevIds.has(giftId)) continue
      if (!partyWide) {
        conditionText =
          next.dm?.room?.condition != null ? conditionOf(next.dm.room.condition).condition : null
        partyWide = true
      }
      cards.push(cardFromHidden(giftId, conditionText))
    }

    if (cards.length > 0) {
      offers[player.characterId] = cards
      players.push(player.characterId)
    }
  }

  if (players.length === 0) return null
  return {
    type: 'boonReveal',
    audience: { players, table: true },
    payload: {
      kind: 'hidden',
      offers,
      names,
      conditionText: partyWide ? conditionText : null,
      partyWide,
    },
  }
}

function newForgeCard(prevSlots: Slot[], nextSlots: Slot[]): RevealCard | null {
  const prevEvolutions = new Set(
    prevSlots
      .filter((s): s is Extract<SlotContent, { kind: 'evolution' }> => s?.kind === 'evolution')
      .map((s) => s.evolutionId),
  )
  const prevCombinations = new Set(
    prevSlots
      .filter((s): s is Extract<SlotContent, { kind: 'combination' }> => s?.kind === 'combination')
      .map((s) => s.combinationId),
  )

  for (let slotIndex = 0; slotIndex < nextSlots.length; slotIndex++) {
    const slot = nextSlots[slotIndex]
    if (slot?.kind === 'evolution' && !prevEvolutions.has(slot.evolutionId)) {
      return cardFromOffer({ kind: 'evolution', evolutionId: slot.evolutionId, slotIndex, source: 'wildcard' }, prevSlots)
    }
    if (slot?.kind === 'combination' && !prevCombinations.has(slot.combinationId)) {
      return cardFromOffer({ kind: 'combination', combinationId: slot.combinationId, source: 'wildcard' }, prevSlots)
    }
  }
  return null
}

function forgeMoment(
  prevById: Map<string, RunPlayer>,
  prev: RunState,
  next: RunState,
  names: Record<string, string>,
): NewMoment<BoonRevealPayload> | null {
  if ((next.run.forgeUsesLeft ?? 0) >= (prev.run.forgeUsesLeft ?? 0)) return null

  for (const player of next.players) {
    const prevSlots = prevById.get(player.characterId)?.slots ?? []
    const card = newForgeCard(prevSlots, player.slots ?? [])
    if (!card) continue
    return {
      type: 'boonReveal',
      audience: { players: [player.characterId], table: true },
      payload: {
        kind: 'forge',
        offers: { [player.characterId]: [card] },
        names,
        conditionText: null,
        partyWide: false,
      },
    }
  }

  return null
}

/**
 * Compare a run's state before and after a DM save and return any boon reveal
 * moments to play (drafts, hidden offers, and Forge Evolve/Combine results).
 */
export function revealsFromChange(prev: RunState | null, next: RunState): NewMoment<BoonRevealPayload>[] {
  if (!prev) return []
  const names = Object.fromEntries(next.players.map((p) => [p.characterId, p.name]))
  const prevById = new Map(prev.players.map((p) => [p.characterId, p]))
  const moments: NewMoment<BoonRevealPayload>[] = []

  const builders = [
    () => draftMoment(prevById, next, names),
    () => hiddenMoment(prevById, next, names),
    () => forgeMoment(prevById, prev, next, names),
  ]

  for (const build of builders) {
    try {
      const moment = build()
      if (moment) moments.push(moment)
    } catch {
      // Moments are presentation only: skip a malformed moment rather than failing the save.
    }
  }

  return moments
}
