// React hooks and helpers for the Lore Library: deck summary, a player's archive notes,
// everyone's counted progress, and full-collection laurel status. Never logs card text.
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import type { LoreNote } from './reveal'
import type { LoreSummary } from './types'

const EMPTY_SUMMARY: LoreSummary = { groups: [], total: 0 }

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

function toLoreSummary(data: Record<string, unknown> | undefined): LoreSummary {
  if (!data) return EMPTY_SUMMARY
  const groups: LoreSummary['groups'] = []
  if (Array.isArray(data.groups)) {
    for (const entry of data.groups) {
      if (typeof entry !== 'object' || entry === null) continue
      const record = entry as Record<string, unknown>
      if (typeof record.id !== 'string' || typeof record.name !== 'string') continue
      const count =
        typeof record.count === 'number' && Number.isFinite(record.count) ? record.count : 0
      groups.push({ id: record.id, name: record.name, count })
    }
  }
  const total = typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : 0
  return { groups, total }
}

function toLoreNote(id: string, data: Record<string, unknown>): LoreNote & { revealedAtMs: number } {
  const note: LoreNote & { revealedAtMs: number } = {
    cardId: typeof data.cardId === 'string' && data.cardId.length > 0 ? data.cardId : id,
    group: typeof data.group === 'string' ? data.group : '',
    title: typeof data.title === 'string' ? data.title : '',
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
    revealId: typeof data.revealId === 'string' ? data.revealId : '',
    counted: data.counted !== false,
    revealedAtMs: toTimestampMs(data.revealedAt) ?? 0,
  }
  if (typeof data.readAloud === 'string') note.readAloud = data.readAloud
  if (typeof data.push === 'string') note.push = data.push
  return note
}

/**
 * Listen to `loreSummary/main` (groups and total counted cards).
 * Returns `null` while loading or when Firebase is not set up, and `{ groups: [], total: 0 }`
 * if the document is missing.
 */
export function useLoreSummary(): LoreSummary | null {
  const [summary, setSummary] = useState<LoreSummary | null>(null)

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      doc(db, 'loreSummary', 'main'),
      (snap) => {
        if (!snap.exists()) {
          setSummary(EMPTY_SUMMARY)
          return
        }
        setSummary(toLoreSummary(snap.data()))
      },
      () => setSummary(EMPTY_SUMMARY),
    )
  }, [])

  return db ? summary : null
}

/**
 * Listen to `loreNotes/{email}/notes` (lowercased email), sorted newest first.
 * Returns `null` while loading, or `[]` when Firebase is not set up, email is empty, or on error.
 */
export function useLoreNotes(
  email: string | null,
): (LoreNote & { revealedAtMs: number })[] | null {
  const normalizedEmail = email ? email.trim().toLowerCase() : ''
  const [loaded, setLoaded] = useState<{
    email: string
    notes: (LoreNote & { revealedAtMs: number })[]
  } | null>(null)

  useEffect(() => {
    if (!db || !normalizedEmail) return
    const firestore = db
    const activeEmail = normalizedEmail
    return onSnapshot(
      collection(firestore, 'loreNotes', activeEmail, 'notes'),
      (snapshot) => {
        const notes = snapshot.docs.map((d) =>
          toLoreNote(d.id, d.data({ serverTimestamps: 'estimate' })),
        )
        notes.sort((a, b) => b.revealedAtMs - a.revealedAtMs)
        setLoaded({ email: activeEmail, notes })
      },
      () => setLoaded({ email: activeEmail, notes: [] }),
    )
  }, [normalizedEmail])

  if (!db || !normalizedEmail) return []
  return loaded && loaded.email === normalizedEmail ? loaded.notes : null
}

/**
 * Listen to the `loreProgress` collection and map each account email (doc id) to its counted
 * note count. Returns `{}` when Firebase is not set up or on error.
 */
export function useLoreProgress(): Record<string, number> {
  const [progress, setProgress] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, 'loreProgress'),
      (snapshot) => {
        const next: Record<string, number> = {}
        for (const d of snapshot.docs) {
          const count = d.data().count
          if (typeof count === 'number' && Number.isFinite(count)) {
            next[d.id] = count
          }
        }
        setProgress(next)
      },
      () => setProgress({}),
    )
  }, [])

  return db ? progress : {}
}

/** Return true when the deck has at least one counted card and the player has seen all of them. */
export function hasLoreLaurel(
  count: number | undefined,
  summary: { total: number } | null,
): boolean {
  return (
    summary !== null &&
    Number.isFinite(summary.total) &&
    summary.total > 0 &&
    typeof count === 'number' &&
    Number.isFinite(count) &&
    count >= summary.total
  )
}
