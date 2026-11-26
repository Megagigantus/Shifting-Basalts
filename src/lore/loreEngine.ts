// Runs the lore trigger engine after a DM run save: queues matching cards and releases one at a pause.
import { collection, doc, getDoc, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { RunState } from '../model/run'
import { EMBEDDED_LORE_DECK, withAdHocCards } from './deck'
import { cardsFromDocs, mergeLoreState } from './loreStore'
import type { LoreQueueItem } from './reveal'
import { deriveLoreEvents } from './runEvents'
import { cardsToQueue, pickRelease } from './triggers'
import { toQueueItem } from './useLoreReveal'

/**
 * Derive lore events from a run save, queue matching cards, and mark at most one
 * waiting card `ready` when the save lands on a natural pause.
 */
export async function processRunChange(
  previous: RunState | null,
  next: RunState,
): Promise<void> {
  if (!db || !next.dm) return
  const firestore = db

  const { events, pauseRoomKey } = deriveLoreEvents(previous, next)
  if (events.length === 0 && !pauseRoomKey) return

  const runId = next.run.id
  const [cardsSnap, stateSnap, queueSnap, loreMetaSnap] = await Promise.all([
    getDocs(collection(firestore, 'loreCards')),
    getDoc(doc(firestore, 'loreState', 'main')),
    getDocs(collection(firestore, 'runs', runId, 'loreQueue')),
    getDoc(doc(firestore, 'runs', runId, 'dmOnly', 'lore')),
  ])

  const cards = withAdHocCards(EMBEDDED_LORE_DECK.cards, cardsFromDocs(cardsSnap.docs))
  if (cards.length === 0) return

  const state = mergeLoreState(stateSnap.exists() ? stateSnap.data() : undefined)
  const queue = queueSnap.docs.map((d) => toQueueItem(d.id, d.data()))
  const rawLastReleaseKey = loreMetaSnap.exists() ? loreMetaSnap.data().lastReleaseKey : null
  const lastReleaseKey = typeof rawLastReleaseKey === 'string' ? rawLastReleaseKey : null

  const queueCol = collection(firestore, 'runs', runId, 'loreQueue')
  const toAdd = cardsToQueue({ events, cards, state, queue })
  const newItems = toAdd.map((entry) => {
    const ref = doc(queueCol)
    const item: LoreQueueItem = {
      id: ref.id,
      cardId: entry.cardId,
      status: 'waiting',
      manual: false,
      ready: false,
      immediate: entry.immediate,
      order: entry.order,
      createdAtMs: Date.now(),
    }
    return { ref, item }
  })

  const releaseId = pauseRoomKey
    ? pickRelease({
        queue: [...queue, ...newItems.map((entry) => entry.item)],
        roomKey: pauseRoomKey,
        lastReleaseKey,
      })
    : null

  if (newItems.length === 0 && !releaseId) return

  const batch = writeBatch(firestore)
  const newIds = new Set<string>()
  for (const { ref, item } of newItems) {
    newIds.add(item.id)
    batch.set(ref, {
      cardId: item.cardId,
      status: item.status,
      manual: item.manual,
      ready: item.id === releaseId,
      immediate: Boolean(item.immediate),
      order: item.order,
      createdAt: serverTimestamp(),
      createdAtMs: item.createdAtMs,
    })
  }

  if (releaseId && pauseRoomKey) {
    if (!newIds.has(releaseId)) {
      batch.update(doc(queueCol, releaseId), { ready: true })
    }
    batch.set(
      doc(firestore, 'runs', runId, 'dmOnly', 'lore'),
      { lastReleaseKey: pauseRoomKey },
      { merge: true },
    )
  }

  await batch.commit()
}

/**
 * Fire-and-forget wrapper that runs lore triggers after a run save and logs
 * only the error message on failure so saves are never blocked or slowed.
 */
// Saves are handled one at a time, so two quick saves never queue the same card twice.
let pending: Promise<void> = Promise.resolve()

export function runLoreAfterSave(previous: RunState | null, next: RunState): void {
  pending = pending
    .then(() => processRunChange(previous, next))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('Lore triggers skipped:', message)
    })
}
