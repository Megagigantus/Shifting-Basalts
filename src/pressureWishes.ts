// Pressure votes before a run (design bible: Runs, Pressure votes). Each
// character's player marks the Pressures they'd like in
// pressureWishes/{characterId}; the DM's lobby shows the count for each. The
// DM still chooses. Starting a run clears the entering characters' wishes.
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

/** Save the Pressures a character's player would like for the next run. */
export async function setPressureWishes(characterId: string, pressures: string[]): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await setDoc(doc(db, 'pressureWishes', characterId), { pressures, updatedAt: serverTimestamp() })
}

/** Live map of characterId -> wished-for Pressure ids. */
export function usePressureWishes(): Record<string, string[]> {
  const [wishes, setWishes] = useState<Record<string, string[]>>({})
  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, 'pressureWishes'),
      (snapshot) => {
        const next: Record<string, string[]> = {}
        for (const d of snapshot.docs) next[d.id] = (d.data().pressures as string[]) ?? []
        setWishes(next)
      },
      () => setWishes({}),
    )
  }, [])
  return wishes
}

/** Names of the given characters who want each Pressure. */
export function wishTally(wishes: Record<string, string[]>, characters: { id: string; name: string }[]): Record<string, string[]> {
  const tally: Record<string, string[]> = {}
  for (const c of characters) for (const id of wishes[c.id] ?? []) (tally[id] ??= []).push(c.name)
  return tally
}
