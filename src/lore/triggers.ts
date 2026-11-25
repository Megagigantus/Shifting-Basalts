// Pure lore trigger engine: matches run events to cards, filters queue candidates, and picks pause releases.
// Browser-safe: no Firebase, React, or Node imports.
import type { LoreQueueItem } from './reveal'
import type { LoreCard, LoreState, LoreTier } from './types'

export type LoreEvent = {
  type: string
  arg?: string
  values?: Record<string, number>
  immediate?: boolean
}

const TIER_RANK: Record<LoreTier, number> = {
  open: 0,
  guarded: 1,
  deep: 2,
}

const COMPARISON_PATTERN = /^([a-zA-Z_][a-zA-Z0-9_-]*)(>=|<=|>|<|=)(-?\d+(?:\.\d+)?)$/
const NUMBER_PATTERN = /^-?\d+(?:\.\d+)?$/

function compareValues(actual: number, op: string, target: number): boolean {
  switch (op) {
    case '>=':
      return actual >= target
    case '<=':
      return actual <= target
    case '>':
      return actual > target
    case '<':
      return actual < target
    case '=':
      return actual === target
    default:
      return false
  }
}

function compareDeckOrder(a: LoreCard, b: LoreCard): number {
  const orderA = a.order ?? 0
  const orderB = b.order ?? 0
  if (orderA !== orderB) return orderA - orderB
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Match a card trigger key (`type` or `type:arg`) against a run event.
 * Dispatch keys never match; string comparisons are case-sensitive.
 */
export function matchesTrigger(key: string, event: LoreEvent): boolean {
  const colonIndex = key.indexOf(':')
  const keyType = colonIndex === -1 ? key : key.slice(0, colonIndex)
  if (keyType === 'dispatch') return false
  if (keyType !== event.type) return false
  if (colonIndex === -1) return true

  const keyArg = key.slice(colonIndex + 1)

  if (keyType === 'pressures_chosen' && NUMBER_PATTERN.test(keyArg)) {
    const required = Number(keyArg)
    const count = event.values && Object.hasOwn(event.values, 'count') ? event.values.count : undefined
    return typeof count === 'number' && Number.isFinite(count) && count >= required
  }

  const cmp = COMPARISON_PATTERN.exec(keyArg)
  if (cmp) {
    const [, name, op, rawTarget] = cmp
    const val = event.values && Object.hasOwn(event.values, name) ? event.values[name] : undefined
    if (typeof val !== 'number' || !Number.isFinite(val)) return false
    return compareValues(val, op, Number(rawTarget))
  }

  if (event.arg === undefined) return false

  const alternatives = keyArg.split('|')
  return alternatives.some((alt) => {
    if (alt.endsWith('*')) {
      return event.arg!.startsWith(alt.slice(0, -1))
    }
    return event.arg === alt
  })
}

/**
 * Expand `hidden_boon_first` events: keep each event, and add `{ type: 'thils_touch' }`
 * whenever no card in the deck has a trigger key matching that hidden boon event.
 */
export function expandHiddenBoonEvents(events: LoreEvent[], cards: LoreCard[]): LoreEvent[] {
  const expanded: LoreEvent[] = []
  for (const event of events) {
    expanded.push(event)
    if (event.type === 'hidden_boon_first') {
      const hasMatch = cards.some((card) => matchesTrigger(card.trigger.key, event))
      if (!hasMatch) {
        expanded.push({ type: 'thils_touch' })
      }
    }
  }
  return expanded
}

/**
 * Determine which cards to add to the run's queue for a batch of events,
 * enforcing repeat rules, deduplication, tier limits, and the per-run Deep cap.
 */
export function cardsToQueue({
  events,
  cards,
  state,
  queue,
}: {
  events: LoreEvent[]
  cards: LoreCard[]
  state: LoreState
  queue: LoreQueueItem[]
}): { cardId: string; order: number; immediate: boolean }[] {
  const expandedEvents = expandHiddenBoonEvents(events, cards)
  const cardById = new Map<string, LoreCard>()
  for (const card of cards) {
    if (!cardById.has(card.id)) {
      cardById.set(card.id, card)
    }
  }

  let deepCount = 0
  const activeCardIds = new Set<string>()
  const onceRunSpentCardIds = new Set<string>()
  for (const item of queue) {
    if (item.status === 'waiting' || item.status === 'live') {
      activeCardIds.add(item.cardId)
      onceRunSpentCardIds.add(item.cardId)
      if (cardById.get(item.cardId)?.tier === 'deep') {
        deepCount += 1
      }
    } else if (item.status === 'done') {
      onceRunSpentCardIds.add(item.cardId)
      if (cardById.get(item.cardId)?.tier === 'deep') {
        deepCount += 1
      }
    } else if (item.status === 'dismissed') {
      onceRunSpentCardIds.add(item.cardId)
    }
  }

  const tierLimitRank = TIER_RANK[state.settings.tierLimit]
  const sortedCards = [...cardById.values()].sort(compareDeckOrder)
  const results: { cardId: string; order: number; immediate: boolean }[] = []

  for (const card of sortedCards) {
    if (card.adHoc || card.trigger.key === 'dispatch') continue

    const matchingEvents = expandedEvents.filter((event) => matchesTrigger(card.trigger.key, event))
    if (matchingEvents.length === 0) continue

    // Only once-per-campaign cards use the all-time seen list; once-per-run cards are tracked on the run.
    if (card.repeat === 'once_campaign' && Object.hasOwn(state.seen, card.id)) continue
    if (card.repeat === 'once_run' && onceRunSpentCardIds.has(card.id)) continue
    if (activeCardIds.has(card.id)) continue
    if (TIER_RANK[card.tier] > tierLimitRank) continue

    if (card.tier === 'deep') {
      if (deepCount >= state.settings.deepPerRun) continue
      deepCount += 1
    }

    results.push({
      cardId: card.id,
      order: card.order ?? 0,
      immediate: matchingEvents.some((event) => Boolean(event.immediate)),
    })
  }

  return results
}

/**
 * Pick the queue item id to mark `ready` at a pause, or `null` if this room already
 * released a card or the DM still has a live, manual, immediate, or ready card pending.
 */
export function pickRelease({
  queue,
  roomKey,
  lastReleaseKey,
}: {
  queue: LoreQueueItem[]
  roomKey: string
  lastReleaseKey: string | null
}): string | null {
  if (roomKey === lastReleaseKey) return null
  if (queue.some((item) => item.status === 'live')) return null
  if (
    queue.some(
      (item) =>
        item.status === 'waiting' && (item.manual || Boolean(item.ready) || Boolean(item.immediate)),
    )
  ) {
    return null
  }

  const candidates = queue.filter((item) => item.status === 'waiting' && !item.ready)
  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.createdAtMs - b.createdAtMs
  })
  return candidates[0].id
}
