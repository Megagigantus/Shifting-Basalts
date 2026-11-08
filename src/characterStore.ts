// Changes to a character's dungeon layer that need checking against the
// latest saved values. Each runs as a Firestore transaction: it re-reads the
// character, checks the rule, then writes, so double-clicks can't overspend.
import { doc, FieldPath, runTransaction, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { investmentCap } from './rules/statTracks'
import { nextRankCost, ownedRankCost, upgradeById } from './rules/upgrades'

/**
 * Buy the next rank of an upgrade with banked Quantum Basalts, or (refund)
 * undo the last rank bought and return what it cost, as a DM correction.
 */
export async function changeUpgrade(characterId: string, upgradeId: string, mode: 'buy' | 'refund'): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const upgrade = upgradeById(upgradeId)
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'characters', characterId)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('That character no longer exists.')
    const data = snapshot.data()
    const banked: number = data.bankedQuantumBasalts ?? 0
    const owned: number = data.upgrades?.[upgradeId] ?? 0

    let newRank: number
    let newBank: number
    if (mode === 'buy') {
      const cost = nextRankCost(upgradeId, owned)
      if (cost === null) throw new Error(`${upgrade.name} is already at its highest rank.`)
      if (cost > banked) throw new Error(`Not enough Quantum Basalts: ${upgrade.name} costs ${cost}.`)
      newRank = owned + 1
      newBank = banked - cost
    } else {
      const cost = ownedRankCost(upgradeId, owned)
      if (cost === null) throw new Error(`No ${upgrade.name} rank to refund.`)
      newRank = owned - 1
      newBank = banked + cost
    }

    tx.update(
      ref,
      new FieldPath('upgrades', upgradeId),
      newRank,
      'bankedQuantumBasalts',
      newBank,
      'updatedAt',
      serverTimestamp(),
    )
  })
}

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
