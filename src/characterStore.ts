// Changes to a character's dungeon layer that need checking against the
// latest saved values. Each runs as a Firestore transaction: it re-reads the
// character, checks the rule, then writes, so double-clicks can't overspend.
import { totalLevel, type BuildFields } from './rules/build'
import { doc, FieldPath, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
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
      if (upgrade.requiresFullClear && !(data.fullClears > 0)) throw new Error(`${upgrade.name} unlocks after a full clear.`)
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
 * DM correction: change how many full clears a character has survived (never
 * below 0). Full clears unlock the full-clear upgrades and the golden glow;
 * runs add them automatically, so this is for clears from before that.
 */
export async function changeFullClears(characterId: string, delta: 1 | -1): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  await runTransaction(firestore, async (tx) => {
    const ref = doc(firestore, 'characters', characterId)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw new Error('That character no longer exists.')
    const current: number = snapshot.data().fullClears ?? 0
    tx.update(ref, { fullClears: Math.max(0, current + delta), updatedAt: serverTimestamp() })
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

/** Save a character's Banish list (between runs only; the rules check the size and ids). */
export async function setBanished(characterId: string, banished: string[]): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await updateDoc(doc(db, 'characters', characterId), { banished, updatedAt: serverTimestamp() })
}

/** Save a character's portrait and summon art (any time; the owning player may do this). */
export async function setCharacterLook(characterId: string, look: { portrait: string; summonArt: string }): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await updateDoc(doc(db, 'characters', characterId), { ...look, updatedAt: serverTimestamp() })
}

/** Save (or clear) a character's Attunement tag (between runs only). */
export async function setAttuneTag(characterId: string, attuneTag: string | null): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await updateDoc(doc(db, 'characters', characterId), { attuneTag, updatedAt: serverTimestamp() })
}

/**
 * Save a character's build (Character setup): classes, levels, subclasses,
 * orders, extra training, mastery picks and homebrew tags. Level is the total
 * of both classes. Players may do this between runs; the rules check the fields.
 */
export async function saveBuild(characterId: string, build: BuildFields): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await updateDoc(doc(db, 'characters', characterId), { ...build, level: totalLevel(build), updatedAt: serverTimestamp() })
}
