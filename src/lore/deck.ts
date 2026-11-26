// Embedded DM lore deck loader, player-safe summary, and ad hoc card merger.
import rawDeck from '../data/lore-deck.json'
import { parseBannedTerms } from './bannedTerms.ts'
import { buildSummary, validateDeckFile } from './deckFile.ts'
import type { LoreCard, LoreDeckFile, LoreSummary } from './types.ts'

const rawBannedTerms = Array.isArray(rawDeck.bannedTerms)
  ? rawDeck.bannedTerms.filter((term): term is string => typeof term === 'string')
  : []

/** Banned terms from the embedded deck file, normalized with parseBannedTerms. */
export const LORE_BANNED_TERMS: string[] = parseBannedTerms(rawBannedTerms.join('\n'))

function loadEmbeddedDeck(): LoreDeckFile {
  const result = validateDeckFile(rawDeck, LORE_BANNED_TERMS)
  if (!result.ok) {
    throw new Error(`Embedded lore deck is invalid: ${result.errors.join('; ')}`)
  }

  return {
    ...result.deck,
    cards: result.deck.cards.map((card, index) => ({
      ...card,
      order: typeof card.order === 'number' && Number.isFinite(card.order) ? card.order : index,
    })),
  }
}

/** Validated embedded lore deck loaded from src/data/lore-deck.json. */
export const EMBEDDED_LORE_DECK: LoreDeckFile = loadEmbeddedDeck()

/** Player-safe summary of the embedded lore deck excluding ad hoc cards. */
export const EMBEDDED_LORE_SUMMARY: LoreSummary = buildSummary(
  EMBEDDED_LORE_DECK.groups,
  EMBEDDED_LORE_DECK.cards,
)

function finiteOrder(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function compareAdHocCards(a: LoreCard, b: LoreCard): number {
  const aOrder = finiteOrder(a.order)
  const bOrder = finiteOrder(b.order)
  if (aOrder !== null && bOrder !== null && aOrder !== bOrder) {
    return aOrder - bOrder
  }
  if ((aOrder !== null) !== (bOrder !== null)) {
    return aOrder !== null ? -1 : 1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Return embedded cards followed by unique stored ad hoc cards sorted by order then id. */
export function withAdHocCards(embedded: LoreCard[], stored: LoreCard[]): LoreCard[] {
  const embeddedIds = new Set(embedded.map((card) => card.id))
  const adHoc = stored
    .filter((card) => card.adHoc === true && !embeddedIds.has(card.id))
    .sort(compareAdHocCards)
  return [...embedded, ...adHoc]
}
