// Firestore actions and live hook for Caretaker-9 dispatches.
// Never logs card text or questions.
import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  adHocAnswerCard,
  askedThisRoom,
  dispatchFromDoc,
  newAdHocId,
  type LoreDispatch,
} from './dispatches'
import { loreImageUrl } from './loreArt'
import { saveCard } from './loreStore'
import { fileNotes, queueReplay } from './revealStore'
import type { LoreCard, LoreTier } from './types'

export interface AnswerDispatchInput {
  dispatch: LoreDispatch
  card: LoreCard
  runActive: boolean
  runId: string
  emails: string[]
  imageUrl: string | null
}

export interface WriteAndAnswerInput {
  dispatch: LoreDispatch
  fields: {
    title: string
    readAloud: string
    push: string
    dmTruth: string
    tier: LoreTier
  }
  runActive: boolean
  runId: string
  emails: string[]
}

/** Log one party question for the current post-boss room, rejecting empty or duplicate rooms. */
export async function askDispatch(
  runId: string,
  floor: number,
  question: string,
): Promise<string> {
  if (!db) throw new Error('Firebase is not set up.')
  const trimmed = question.trim()
  if (!trimmed) throw new Error('Type a question first.')

  const firestore = db
  const existingSnap = await getDocs(
    query(collection(firestore, 'loreDispatches'), where('runId', '==', runId)),
  )
  const existing = existingSnap.docs.map((d) => dispatchFromDoc(d.id, d.data()))
  if (askedThisRoom(existing, runId, floor)) {
    throw new Error('This room already sent a question.')
  }

  const ref = await addDoc(collection(firestore, 'loreDispatches'), {
    question: trimmed,
    runId,
    floor,
    status: 'pending',
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  })
  return ref.id
}

/**
 * Deliver a dispatch answer card: queue it in the reveal drawer while the run is active,
 * or file it straight into players' Libraries and mark it seen after the run ends.
 */
export async function answerDispatch({
  dispatch,
  card,
  runActive,
  runId,
  emails,
  imageUrl,
}: AnswerDispatchInput): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db

  if (runActive) {
    await queueReplay(runId, card.id)
  } else {
    await fileNotes({
      card,
      imageUrl,
      emails,
      revealId: crypto.randomUUID(),
      fills: {},
      shown: { text: true, more: Boolean(card.push.trim()) },
    })
    await setDoc(
      doc(firestore, 'loreState', 'main'),
      { seen: { [card.id]: Date.now() } },
      { merge: true },
    )
  }

  await updateDoc(doc(firestore, 'loreDispatches', dispatch.id), {
    status: 'answered',
    answerCardId: card.id,
    answeredAt: serverTimestamp(),
  })
}

/**
 * Build and validate a DM-written ad-hoc answer card; if valid, save and deliver it,
 * returning validation errors if any.
 */
export async function writeAndAnswer({
  dispatch,
  fields,
  runActive,
  runId,
  emails,
}: WriteAndAnswerInput): Promise<string[]> {
  if (!db) throw new Error('Firebase is not set up.')
  const card = adHocAnswerCard(
    {
      question: dispatch.question,
      title: fields.title,
      readAloud: fields.readAloud,
      push: fields.push,
      dmTruth: fields.dmTruth,
      tier: fields.tier,
    },
    newAdHocId(),
  )
  const errors = await saveCard(card)
  if (errors.length > 0) return errors

  await answerDispatch({
    dispatch,
    card,
    runActive,
    runId,
    emails,
    imageUrl: loreImageUrl(card),
  })
  return []
}

/** Listen to `loreDispatches` for a run, returning an empty list when `runId` is null or Firebase is absent. */
export function useDispatches(runId: string | null): LoreDispatch[] {
  const [loaded, setLoaded] = useState<{ runId: string; items: LoreDispatch[] } | null>(null)

  useEffect(() => {
    if (!db || !runId) return
    const firestore = db
    const activeRunId = runId
    return onSnapshot(
      query(collection(firestore, 'loreDispatches'), where('runId', '==', activeRunId)),
      (snapshot) => {
        const items = snapshot.docs.map((d) =>
          dispatchFromDoc(d.id, d.data({ serverTimestamps: 'estimate' })),
        )
        setLoaded({ runId: activeRunId, items })
      },
      () => setLoaded({ runId: activeRunId, items: [] }),
    )
  }, [runId])

  return runId && loaded && loaded.runId === runId ? loaded.items : []
}
