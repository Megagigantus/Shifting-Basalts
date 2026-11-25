// Pure helpers for lore reveal payloads, archive notes, placeholder filling, and queue ordering.
// Browser-safe: no Firebase, React, or Node imports. Never logs card text or fills.
import type { LoreCard } from './types'

export type RevealStage = 'image' | 'text' | 'more' | 'closed'

export interface LoreRevealDoc {
  revealId: string
  stage: RevealStage
  title: string
  imageUrl: string | null
  readAloud?: string
  push?: string
}

export interface LoreQueueItem {
  id: string
  cardId: string
  status: 'waiting' | 'live' | 'done' | 'skipped' | 'dismissed'
  manual: boolean
  order: number
  createdAtMs: number
  revealId?: string
  stage?: 'image' | 'text' | 'more'
  audience?: string[]
  everyone?: boolean
  fills?: Record<string, string>
  targetEmails?: string[]
}

export interface RevealTarget {
  characterId: string
  playerEmail: string
}

export interface LoreNote {
  cardId: string
  group: string
  title: string
  imageUrl: string | null
  readAloud?: string
  push?: string
  revealId: string
}

export interface ShownFlags {
  text: boolean
  more: boolean
}

const PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g

/** Replace each `{name}` with the trimmed fill when non-empty; leave `{name}` as-is when missing or blank. */
export function fillPlaceholders(text: string, fills: Record<string, string>): string {
  return text.replace(PLACEHOLDER_PATTERN, (match, name: string) => {
    if (!Object.hasOwn(fills, name)) return match
    const raw = fills[name]
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    return trimmed.length > 0 ? trimmed : match
  })
}

/** Return unique placeholder names from `card.placeholders` without a non-blank fill value. */
export function missingFills(card: LoreCard, fills: Record<string, string>): string[] {
  const missing: string[] = []
  const seen = new Set<string>()
  for (const name of card.placeholders) {
    if (seen.has(name)) continue
    seen.add(name)
    const raw = Object.hasOwn(fills, name) ? fills[name] : undefined
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      missing.push(name)
    }
  }
  return missing
}

/**
 * Build a player-safe reveal document for one stage.
 * Never includes `dmTruth`, `id`, `cardId`, or other DM-only card fields.
 */
export function buildRevealDoc(
  card: LoreCard,
  stage: RevealStage,
  revealId: string,
  imageUrl: string | null,
  fills: Record<string, string>,
  shown: ShownFlags,
): LoreRevealDoc {
  const doc: LoreRevealDoc = {
    revealId,
    stage,
    title: card.title,
    imageUrl,
  }
  if (stage !== 'image' && shown.text) {
    doc.readAloud = fillPlaceholders(card.readAloud, fills)
  }
  if ((stage === 'more' || stage === 'closed') && shown.more && card.push.trim().length > 0) {
    doc.push = card.push
  }
  return doc
}

/**
 * Build a player's archive note for a finished reveal.
 * Never includes `dmTruth` or other DM-only card fields; omits unshown or empty text fields.
 */
export function buildNote(
  card: LoreCard,
  revealId: string,
  imageUrl: string | null,
  fills: Record<string, string>,
  shown: ShownFlags,
): LoreNote {
  const note: LoreNote = {
    cardId: card.id,
    group: card.group,
    title: card.title,
    imageUrl,
    revealId,
  }
  if (shown.text) {
    note.readAloud = fillPlaceholders(card.readAloud, fills)
  }
  if (shown.more && card.push.trim().length > 0) {
    note.push = card.push
  }
  return note
}

function compareWaiting(a: LoreQueueItem, b: LoreQueueItem): number {
  if (a.manual !== b.manual) return a.manual ? -1 : 1
  if (a.order !== b.order) return a.order - b.order
  return a.createdAtMs - b.createdAtMs
}

/**
 * Return the current queue item: the `'live'` item if any, otherwise the highest-priority
 * `'waiting'` item (manual first, then `order` ascending, then `createdAtMs` ascending).
 */
export function nextQueueItem(items: LoreQueueItem[]): LoreQueueItem | null {
  const live = items.find((item) => item.status === 'live')
  if (live) return live

  const waiting = items.filter((item) => item.status === 'waiting')
  if (waiting.length === 0) return null

  waiting.sort(compareWaiting)
  return waiting[0]
}

/** Number of `'waiting'` items not returned by `nextQueueItem`. */
export function waitingCount(items: LoreQueueItem[]): number {
  const current = nextQueueItem(items)
  return items.filter((item) => item.status === 'waiting' && item !== current).length
}
