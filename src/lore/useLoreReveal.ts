// React hooks for listening to the DM's lore queue and a player's (or table's) live lore reveal.
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import {
  nextQueueItem,
  waitingCount,
  type LoreQueueItem,
  type LoreRevealDoc,
  type RevealStage,
} from './reveal'

function toStringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      record[key] = entry
    }
  }
  return record
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function toTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Timestamp).toMillis === 'function'
  ) {
    return (value as Timestamp).toMillis()
  }
  return null
}

export function toQueueItem(id: string, data: Record<string, unknown>): LoreQueueItem {
  const status: LoreQueueItem['status'] =
    data.status === 'waiting' ||
    data.status === 'live' ||
    data.status === 'done' ||
    data.status === 'skipped' ||
    data.status === 'dismissed'
      ? data.status
      : 'done'

  const item: LoreQueueItem = {
    id,
    cardId: typeof data.cardId === 'string' ? data.cardId : '',
    status,
    manual: data.manual === true,
    order: typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : 0,
    createdAtMs: toTimestampMs(data.createdAtMs) ?? toTimestampMs(data.createdAt) ?? 0,
  }

  if (data.ready === true) item.ready = true
  if (data.immediate === true) item.immediate = true
  if (typeof data.revealId === 'string') item.revealId = data.revealId
  if (data.stage === 'image' || data.stage === 'text' || data.stage === 'more') {
    item.stage = data.stage
  }
  const audience = toStringArray(data.audience)
  if (audience) item.audience = audience
  if (typeof data.everyone === 'boolean') item.everyone = data.everyone
  const fills = toStringRecord(data.fills)
  if (fills) item.fills = fills
  const targetEmails = toStringArray(data.targetEmails)
  if (targetEmails) item.targetEmails = targetEmails

  return item
}

function toRevealStage(value: unknown): RevealStage | null {
  if (value === 'image' || value === 'text' || value === 'more' || value === 'closed') {
    return value
  }
  return null
}

function toRevealDoc(data: Record<string, unknown>): LoreRevealDoc | null {
  const stage = toRevealStage(data.stage)
  if (!stage || typeof data.revealId !== 'string' || typeof data.title !== 'string') {
    return null
  }
  const reveal: LoreRevealDoc = {
    revealId: data.revealId,
    stage,
    title: data.title,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
  }
  if (typeof data.readAloud === 'string') reveal.readAloud = data.readAloud
  if (typeof data.push === 'string') reveal.push = data.push
  return reveal
}

function pickLatestReveal(
  entries: Iterable<{ doc: LoreRevealDoc; updatedAtMs: number }>,
): LoreRevealDoc | null {
  let latest: { doc: LoreRevealDoc; updatedAtMs: number } | null = null
  for (const entry of entries) {
    if (!latest || entry.updatedAtMs > latest.updatedAtMs) {
      latest = entry
    }
  }
  return latest ? latest.doc : null
}

/** Listen to the DM-only `loreQueue` for a run and compute the current and waiting counts. */
export function useLoreQueue(runId: string | null): {
  items: LoreQueueItem[]
  current: LoreQueueItem | null
  waiting: number
} {
  const [loaded, setLoaded] = useState<{ runId: string; items: LoreQueueItem[] } | null>(null)

  useEffect(() => {
    if (!db || !runId) return
    const firestore = db
    const activeRunId = runId
    return onSnapshot(
      collection(firestore, 'runs', activeRunId, 'loreQueue'),
      (snapshot) => {
        const items = snapshot.docs.map((d) =>
          toQueueItem(d.id, d.data({ serverTimestamps: 'estimate' })),
        )
        setLoaded({ runId: activeRunId, items })
      },
      () => setLoaded({ runId: activeRunId, items: [] }),
    )
  }, [runId])

  const items = runId && loaded && loaded.runId === runId ? loaded.items : []
  const active = items.filter((item) => item.status === 'waiting' || item.status === 'live')
  return {
    items,
    current: nextQueueItem(active),
    waiting: waitingCount(active),
  }
}

/**
 * Listen to `loreReveal/{id}` for each character id (or `['_table']` for the Table display)
 * and return the reveal document with the latest `updatedAt`, or `null` if none exist.
 */
export function usePlayerLoreReveal(
  runId: string | null,
  characterIds: string[],
): LoreRevealDoc | null {
  const [loaded, setLoaded] = useState<{ key: string; doc: LoreRevealDoc | null } | null>(null)
  const uniqueIds = [...new Set(characterIds.filter(Boolean))]
  const idsKey = JSON.stringify(uniqueIds)
  const key = runId && uniqueIds.length > 0 ? `${runId}\0${idsKey}` : null

  useEffect(() => {
    if (!db || !runId || !key) return
    const firestore = db
    const activeRunId = runId
    const activeKey = key
    const activeIds = JSON.parse(idsKey) as string[]
    const byId = new Map<string, { doc: LoreRevealDoc; updatedAtMs: number }>()
    let cancelled = false

    const publish = () => {
      if (cancelled) return
      setLoaded({ key: activeKey, doc: pickLatestReveal(byId.values()) })
    }

    const unsubs = activeIds.map((id) =>
      onSnapshot(
        doc(firestore, 'runs', activeRunId, 'loreReveal', id),
        (snap) => {
          if (cancelled) return
          if (!snap.exists()) {
            byId.delete(id)
            publish()
            return
          }
          const data = snap.data({ serverTimestamps: 'estimate' })
          const reveal = toRevealDoc(data)
          if (!reveal) {
            byId.delete(id)
            publish()
            return
          }
          byId.set(id, {
            doc: reveal,
            updatedAtMs: toTimestampMs(data.updatedAt) ?? 0,
          })
          publish()
        },
        () => {
          byId.delete(id)
          publish()
        },
      ),
    )

    return () => {
      cancelled = true
      for (const unsub of unsubs) unsub()
    }
  }, [runId, idsKey, key])

  return key && loaded && loaded.key === key ? loaded.doc : null
}
