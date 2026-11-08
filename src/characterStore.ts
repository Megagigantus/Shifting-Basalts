// Changes to a character's dungeon layer that need checking against the
// latest saved values. Each runs as a Firestore transaction: it re-reads the
// character, checks the rule, then writes, so double-clicks can't overspend.
import { doc, FieldPath, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { investmentCap } from './rules/statTracks'

/**
 * Move Devotions between the bank and a stat track.
 * amount > 0 invests from the bank; amount < 0 is a DM correction that refunds.
 */
export async function investDevotions(characterId: string, trackId: string, amount: number): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'characters', characterId)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('That character no longer exists.')
    const data = snapshot.data()
    const banked: number = data.bankedDevotions ?? 0
    const invested: number = data.trackDevotions?.[trackId] ?? 0
    const next = invested + amount

    if (amount > 0 && amount > banked) throw new Error('Not enough banked Devotions.')
    if (amount > 0 && next > investmentCap(data.level)) {
      throw new Error('That would go past the tier cap for this level.')
    }
    if (next < 0) throw new Error('Nothing to remove from that track.')

    tx.update(
      ref,
      new FieldPath('trackDevotions', trackId),
      next,
      'bankedDevotions',
      banked - amount,
      'updatedAt',
      serverTimestamp(),
    )
  })
}
