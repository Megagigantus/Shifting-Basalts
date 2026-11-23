import { useCallback, useEffect, useReducer } from 'react'
import {
  collection,
  doc,
  getDocs,
  limit,
  writeBatch,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type DocumentReference,
  type Timestamp,
  type WriteBatch,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import {
  arrivalsFromChanges,
  EMPTY_QUEUE,
  inAudience,
  reduceQueue,
  type PlayingMoment,
  type QueueAction,
  type QueueState,
} from './queue'
import type { Moment, MomentAudience, MomentStatus, MomentViewer, NewMoment } from './types'

/** A fresh auto-id document reference under `runs/{runId}/moments`. */
export function newMomentRef(runId: string): DocumentReference {
  if (!db) throw new Error('Firebase is not set up.')
  return doc(collection(db, 'runs', runId, 'moments'))
}

/** Build the Firestore payload written for a newly created moment. */
export function momentData(input: NewMoment, createdBy: string) {
  return {
    type: input.type,
    payload: input.payload,
    audience: input.audience,
    createdAt: serverTimestamp(),
    createdBy,
    status: 'playing' as const,
  }
}

/** Add a new moment write to an existing Firestore batch and return its id. */
export function addMomentToBatch(batch: WriteBatch, runId: string, input: NewMoment): string {
  if (!db) throw new Error('Firebase is not set up.')
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in first.')
  const ref = newMomentRef(runId)
  batch.set(ref, momentData(input, uid))
  return ref.id
}

/** Write a new moment document to Firestore and return its id. */
export async function createMoment(runId: string, input: NewMoment): Promise<string> {
  if (!db) throw new Error('Firebase is not set up.')
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in first.')
  const ref = newMomentRef(runId)
  await setDoc(ref, momentData(input, uid))
  return ref.id
}

/** Update only the status field of an existing moment document. */
export async function setMomentStatus(
  runId: string,
  momentId: string,
  status: MomentStatus,
): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await updateDoc(doc(db, 'runs', runId, 'moments', momentId), { status })
}

/**
 * Delete every moment of a run (when it is cancelled or ends). Moments are
 * presentation only, so losing them never changes game state.
 */
export async function deleteRunMoments(runId: string): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const snapshot = await getDocs(collection(db, 'runs', runId, 'moments'))
  // A batch holds at most 500 writes.
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const batch = writeBatch(db)
    for (const d of snapshot.docs.slice(i, i + 400)) batch.delete(d.ref)
    await batch.commit()
  }
}

function toMoment(id: string, data: DocumentData): Moment {
  const rawCreatedAt = data.createdAt as Timestamp | null | undefined
  const createdAtMs =
    rawCreatedAt && typeof rawCreatedAt.toMillis === 'function' ? rawCreatedAt.toMillis() : null
  const rawAudience = data.audience as Partial<MomentAudience> | undefined
  const audience: MomentAudience = rawAudience
    ? {
        players:
          rawAudience.players === 'all' ||
          rawAudience.players === 'none' ||
          Array.isArray(rawAudience.players)
            ? rawAudience.players
            : 'none',
        table: typeof rawAudience.table === 'boolean' ? rawAudience.table : false,
      }
    : { players: 'none', table: false }
  const status: MomentStatus =
    data.status === 'playing' || data.status === 'skipped' || data.status === 'done'
      ? data.status
      : 'done'
  return {
    id,
    type: typeof data.type === 'string' ? data.type : '',
    payload: data.payload && typeof data.payload === 'object' ? (data.payload as Record<string, unknown>) : {},
    audience,
    createdAtMs,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    status,
  }
}

interface RunQueueState {
  runId: string | null
  queue: QueueState
}

type RunQueueAction =
  | { type: 'reset'; runId: string | null }
  | { type: 'queue'; runId: string; action: QueueAction }
  | { type: 'finish'; id: string }

function reduceRunQueue(state: RunQueueState, action: RunQueueAction): RunQueueState {
  if (action.type === 'reset') {
    if (state.runId === action.runId && state.queue === EMPTY_QUEUE) return state
    return { runId: action.runId, queue: EMPTY_QUEUE }
  }
  if (action.type === 'finish') {
    const next = reduceQueue(state.queue, { type: 'finish', id: action.id })
    return next === state.queue ? state : { ...state, queue: next }
  }
  const base = state.runId === action.runId ? state.queue : EMPTY_QUEUE
  const next = reduceQueue(base, action.action)
  if (state.runId === action.runId && next === base) return state
  return { runId: action.runId, queue: next }
}

/**
 * Subscribe to moments for the active run and queue those targeting `viewer`.
 * Ignores existing documents on the initial snapshot so late joiners never replay.
 */
export function useMomentQueue(
  runId: string | null,
  viewer: MomentViewer,
): { current: PlayingMoment | null; waitingCount: number; finish: (id: string) => void } {
  const [state, dispatch] = useReducer(reduceRunQueue, { runId, queue: EMPTY_QUEUE })
  const viewerKey =
    viewer.kind === 'player'
      ? JSON.stringify({ kind: 'player', characterIds: viewer.characterIds })
      : JSON.stringify({ kind: viewer.kind })

  useEffect(() => {
    dispatch({ type: 'reset', runId })
  }, [runId])

  useEffect(() => {
    if (!db || !runId) return
    const firestore = db
    const activeRunId = runId
    const activeViewer = JSON.parse(viewerKey) as MomentViewer
    let isFirstSnapshot = true
    const q = query(collection(firestore, 'runs', activeRunId, 'moments'), orderBy('createdAt', 'desc'), limit(20))
    return onSnapshot(q, (snapshot) => {
      const changes = snapshot.docChanges().map((change) => ({
        type: change.type,
        moment: toMoment(change.doc.id, change.doc.data({ serverTimestamps: 'estimate' })),
      }))
      const actions = arrivalsFromChanges(changes, isFirstSnapshot, Date.now())
      isFirstSnapshot = false
      for (const action of actions) {
        if (action.type === 'arrive' && !inAudience(action.moment, activeViewer)) continue
        dispatch({ type: 'queue', runId: activeRunId, action })
      }
    })
  }, [runId, viewerKey])

  const finish = useCallback((id: string) => {
    dispatch({ type: 'finish', id })
  }, [])

  const activeQueue = state.runId === runId ? state.queue : EMPTY_QUEUE
  return {
    current: activeQueue.current,
    waitingCount: activeQueue.waiting.length,
    finish,
  }
}
