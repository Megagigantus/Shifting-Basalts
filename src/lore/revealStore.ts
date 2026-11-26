// Firestore actions for queuing, revealing, advancing, finishing, skipping, and dismissing lore cards.
// Never logs cards, fills, or reveal/note documents.
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import { buildNote, buildRevealDoc, type LoreQueueItem, type RevealTarget, type ShownFlags } from './reveal'
import type { LoreCard } from './types'

export interface StartRevealInput {
  runId: string
  item: LoreQueueItem
  card: LoreCard
  imageUrl: string | null
  targets: RevealTarget[]
  everyone: boolean
  fills: Record<string, string>
}

export interface AdvanceRevealInput {
  runId: string
  item: LoreQueueItem
  card: LoreCard
  imageUrl: string | null
  stage: 'text' | 'more'
}

export interface FinishRevealInput {
  runId: string
  item: LoreQueueItem
  card: LoreCard
  imageUrl: string | null
}

export interface FileNotesInput {
  card: LoreCard
  imageUrl: string | null
  emails: string[]
  revealId: string
  fills: Record<string, string>
  shown: ShownFlags
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

/** Add a card to a run's DM-only lore queue for manual replay. */
export async function queueReplay(runId: string, cardId: string): Promise<string> {
  if (!db) throw new Error('Firebase is not set up.')
  const ref = await addDoc(collection(db, 'runs', runId, 'loreQueue'), {
    cardId,
    status: 'waiting',
    manual: true,
    order: 0,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  })
  return ref.id
}

/**
 * Start revealing a queued card at stage `'image'` to the chosen targets (and `_table` when
 * `everyone` is true), mark the queue item `'live'`, and record the card as seen.
 */
export async function startReveal({
  runId,
  item,
  card,
  imageUrl,
  targets,
  everyone,
  fills,
}: StartRevealInput): Promise<string> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const revealId = crypto.randomUUID()
  const audience = uniqueStrings(targets.map((target) => target.characterId))
  const targetEmails = uniqueStrings(
    targets.map((target) => target.playerEmail.trim().toLowerCase()),
  )
  const revealData = {
    ...buildRevealDoc(card, 'image', revealId, imageUrl, fills, { more: false }),
    updatedAt: serverTimestamp(),
  }

  const batch = writeBatch(firestore)
  for (const characterId of audience) {
    batch.set(doc(firestore, 'runs', runId, 'loreReveal', characterId), revealData)
  }
  if (everyone) {
    batch.set(doc(firestore, 'runs', runId, 'loreReveal', '_table'), revealData)
  }
  batch.update(doc(firestore, 'runs', runId, 'loreQueue', item.id), {
    status: 'live',
    revealId,
    stage: 'image',
    audience,
    everyone,
    fills,
    targetEmails,
  })
  batch.set(
    doc(firestore, 'loreState', 'main'),
    { seen: { [card.id]: Date.now() } },
    { merge: true },
  )
  await batch.commit()
  return revealId
}

/** Advance a live reveal to `'text'` or `'more'` for its audience (and `_table` if `everyone`). */
export async function advanceReveal({
  runId,
  item,
  card,
  imageUrl,
  stage,
}: AdvanceRevealInput): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const revealId = item.revealId ?? crypto.randomUUID()
  const fills = item.fills ?? {}
  const shown = { more: stage === 'more' }
  const revealData = {
    ...buildRevealDoc(card, stage, revealId, imageUrl, fills, shown),
    updatedAt: serverTimestamp(),
  }

  const batch = writeBatch(firestore)
  for (const characterId of item.audience ?? []) {
    batch.update(doc(firestore, 'runs', runId, 'loreReveal', characterId), revealData)
  }
  if (item.everyone) {
    batch.update(doc(firestore, 'runs', runId, 'loreReveal', '_table'), revealData)
  }
  batch.update(doc(firestore, 'runs', runId, 'loreQueue', item.id), { stage })
  await batch.commit()
}

/**
 * Finish a live reveal: close every audience reveal doc (keeping shown `push`), write archive notes
 * for each distinct target email with merge, and mark the queue item `'done'`.
 */
export async function finishReveal({
  runId,
  item,
  card,
  imageUrl,
}: FinishRevealInput): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const revealId = item.revealId ?? crypto.randomUUID()
  const fills = item.fills ?? {}
  const shown = { more: item.stage === 'more' }
  const revealData = {
    ...buildRevealDoc(card, 'closed', revealId, imageUrl, fills, shown),
    updatedAt: serverTimestamp(),
  }
  const noteData = {
    ...buildNote(card, revealId, imageUrl, fills, shown),
    revealedAt: serverTimestamp(),
  }

  const targetEmails = uniqueStrings(
    (item.targetEmails ?? []).map((entry) => entry.trim().toLowerCase()),
  )
  const batch = writeBatch(firestore)
  for (const characterId of item.audience ?? []) {
    batch.set(doc(firestore, 'runs', runId, 'loreReveal', characterId), revealData)
  }
  if (item.everyone) {
    batch.set(doc(firestore, 'runs', runId, 'loreReveal', '_table'), revealData)
  }
  for (const email of targetEmails) {
    batch.set(doc(firestore, 'loreNotes', email, 'notes', card.id), noteData, { merge: true })
  }
  batch.update(doc(firestore, 'runs', runId, 'loreQueue', item.id), { status: 'done' })
  await batch.commit()

  await recountProgress(targetEmails)
}

/** Recount counted lore notes for each player email and write `loreProgress/{email}`. */
export async function recountProgress(emails: string[]): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const targetEmails = uniqueStrings(emails.map((entry) => entry.trim().toLowerCase()))
  await Promise.all(
    targetEmails.map(async (email) => {
      try {
        const notesSnap = await getDocs(collection(firestore, 'loreNotes', email, 'notes'))
        let count = 0
        for (const noteDoc of notesSnap.docs) {
          if (noteDoc.data().counted !== false) count += 1
        }
        await setDoc(doc(firestore, 'loreProgress', email), {
          count,
          updatedAt: serverTimestamp(),
        })
      } catch {
        console.warn('Could not update lore progress count.')
      }
    }),
  )
}

/** Write archive notes for each email (with merge) and recount their lore progress. */
export async function fileNotes({
  card,
  imageUrl,
  emails,
  revealId,
  fills,
  shown,
}: FileNotesInput): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const targetEmails = uniqueStrings(emails.map((entry) => entry.trim().toLowerCase()))
  if (targetEmails.length === 0) return

  const noteData = {
    ...buildNote(card, revealId, imageUrl, fills, shown),
    revealedAt: serverTimestamp(),
  }
  const batch = writeBatch(firestore)
  for (const email of targetEmails) {
    batch.set(doc(firestore, 'loreNotes', email, 'notes', card.id), noteData, { merge: true })
  }
  await batch.commit()
  await recountProgress(targetEmails)
}

/** Skip a queued lore card without marking it seen. */
export async function skipItem(runId: string, itemId: string): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await updateDoc(doc(db, 'runs', runId, 'loreQueue', itemId), { status: 'skipped' })
}

/** Dismiss a queued lore card and mark it seen so it does not re-trigger. */
export async function dismissItem(runId: string, item: LoreQueueItem): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const batch = writeBatch(firestore)
  batch.update(doc(firestore, 'runs', runId, 'loreQueue', item.id), { status: 'dismissed' })
  batch.set(
    doc(firestore, 'loreState', 'main'),
    { seen: { [item.cardId]: Date.now() } },
    { merge: true },
  )
  await batch.commit()
}
