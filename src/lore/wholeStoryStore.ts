// Firestore batch writers to show and close "The whole story" pictures on player and table screens.
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import type { LoreRevealDoc } from './reveal'

function targetDocIds(characterIds: readonly string[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of characterIds) {
    if (!id || id === '_table' || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  ids.push('_table')
  return ids
}

async function writeStoryReveal(
  firestore: NonNullable<typeof db>,
  runId: string,
  characterIds: readonly string[],
  revealId: string,
  stage: 'image' | 'closed',
  title: string,
  imageUrl: string | null,
): Promise<void> {
  const revealData: LoreRevealDoc & { updatedAt: ReturnType<typeof serverTimestamp> } = {
    revealId,
    stage,
    title,
    imageUrl,
    updatedAt: serverTimestamp(),
  }
  const batch = writeBatch(firestore)
  for (const id of targetDocIds(characterIds)) {
    batch.set(doc(firestore, 'runs', runId, 'loreReveal', id), revealData)
  }
  await batch.commit()
}

/** Show a story picture (title + image only) on every run character's screen and `_table`. */
export async function showStoryImage(
  runId: string,
  characterIds: readonly string[],
  title: string,
  imageUrl: string | null,
): Promise<string> {
  if (!db) throw new Error('Firebase is not set up.')
  const revealId = crypto.randomUUID()
  await writeStoryReveal(db, runId, characterIds, revealId, 'image', title, imageUrl)
  return revealId
}

/** Close a previously shown story picture on every run character's screen and `_table`. */
export async function closeStoryImage(
  runId: string,
  characterIds: readonly string[],
  revealId: string,
  title: string,
  imageUrl: string | null,
): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await writeStoryReveal(db, runId, characterIds, revealId, 'closed', title, imageUrl)
}
