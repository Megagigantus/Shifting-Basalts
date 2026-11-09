// Proves firestore.rules keeps the app invite-only.
// Runs against a local Firestore emulator with a fake "demo-" project,
// so it never touches the real database. Run with: npm run test:rules
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  FieldPath,
  runTransaction,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'

const DM = 'dm@example.com'
const PLAYER = 'player@example.com'
const OTHER_PLAYER = 'other@example.com'
const STRANGER = 'stranger@example.com'

let env: RulesTestEnvironment

/** A signed-in Google user with the given email. */
function as(email: string, emailVerified = true) {
  return env
    .authenticatedContext(`uid-${email}`, { email, email_verified: emailVerified })
    .firestore()
}

beforeAll(async () => {
  setLogLevel('error')
  env = await initializeTestEnvironment({
    projectId: 'demo-shifting-basalts',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await env.cleanup()
})

// Fresh sample data before every test, written with the rules switched off.
beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'invites', DM), { role: 'dm' })
    await setDoc(doc(db, 'invites', PLAYER), { role: 'player' })
    await setDoc(doc(db, 'invites', OTHER_PLAYER), { role: 'player' })
    await setDoc(doc(db, 'characters', 'c1'), { name: 'Test Character' })
    await setDoc(doc(db, 'runs', 'r1'), { floor: 1 })
    await setDoc(doc(db, 'runs', 'r1', 'players', 'c1'), { slots: [] })
    await setDoc(doc(db, 'runs', 'r1', 'dmOnly', 'current'), { hiddenCondition: 3 })
    await setDoc(doc(db, 'runHistory', 'h1'), { result: 'extracted' })
  })
})

const sharedDocs = [
  ['characters', 'c1'],
  ['runs', 'r1'],
  ['runs', 'r1', 'players', 'c1'],
  ['runHistory', 'h1'],
] as const

describe('signed out', () => {
  it('can read nothing', async () => {
    const db = env.unauthenticatedContext().firestore()
    for (const path of sharedDocs) await assertFails(getDoc(doc(db, ...(path as [string, string]))))
    await assertFails(getDoc(doc(db, 'runs', 'r1', 'dmOnly', 'current')))
    await assertFails(getDoc(doc(db, 'invites', DM)))
  })
})

describe('signed in but not invited', () => {
  it('can read nothing', async () => {
    const db = as(STRANGER)
    for (const path of sharedDocs) await assertFails(getDoc(doc(db, ...(path as [string, string]))))
    await assertFails(getDoc(doc(db, 'runs', 'r1', 'dmOnly', 'current')))
    await assertFails(getDoc(doc(db, 'invites', DM)))
  })

  it('can check its own (missing) invite', async () => {
    await assertSucceeds(getDoc(doc(as(STRANGER), 'invites', STRANGER)))
  })

  it('cannot invite itself', async () => {
    await assertFails(setDoc(doc(as(STRANGER), 'invites', STRANGER), { role: 'player' }))
    await assertFails(setDoc(doc(as(STRANGER), 'invites', STRANGER), { role: 'dm' }))
  })

  it('cannot write data', async () => {
    await assertFails(setDoc(doc(as(STRANGER), 'characters', 'c2'), { name: 'Intruder' }))
  })
})

describe('invited email that Google has not verified', () => {
  it('is treated as not invited', async () => {
    const db = as(DM, false)
    await assertFails(getDoc(doc(db, 'characters', 'c1')))
    await assertFails(getDoc(doc(db, 'runs', 'r1', 'dmOnly', 'current')))
  })
})

describe('invited player', () => {
  it('can read shared data', async () => {
    const db = as(PLAYER)
    for (const path of sharedDocs) await assertSucceeds(getDoc(doc(db, ...(path as [string, string]))))
  })

  it('can never read DM-only data', async () => {
    await assertFails(getDoc(doc(as(PLAYER), 'runs', 'r1', 'dmOnly', 'current')))
  })

  it('can read its own invite but not anyone else\'s', async () => {
    await assertSucceeds(getDoc(doc(as(PLAYER), 'invites', PLAYER)))
    await assertFails(getDoc(doc(as(PLAYER), 'invites', DM)))
    await assertFails(getDoc(doc(as(PLAYER), 'invites', OTHER_PLAYER)))
  })

  it('cannot promote itself, invite others or remove anyone', async () => {
    await assertFails(setDoc(doc(as(PLAYER), 'invites', PLAYER), { role: 'dm' }))
    await assertFails(setDoc(doc(as(PLAYER), 'invites', STRANGER), { role: 'player' }))
    await assertFails(deleteDoc(doc(as(PLAYER), 'invites', OTHER_PLAYER)))
  })

  it('cannot write shared or DM-only data (yet)', async () => {
    const db = as(PLAYER)
    await assertFails(setDoc(doc(db, 'characters', 'c1'), { name: 'Edited' }))
    await assertFails(setDoc(doc(db, 'runs', 'r1'), { floor: 5 }))
    await assertFails(setDoc(doc(db, 'runs', 'r1', 'players', 'c1'), { slots: ['x'] }))
    await assertFails(setDoc(doc(db, 'runs', 'r1', 'dmOnly', 'current'), { hiddenCondition: 1 }))
  })
})

describe('DM', () => {
  it('can read and write everything, including DM-only data', async () => {
    const db = as(DM)
    for (const path of sharedDocs) await assertSucceeds(getDoc(doc(db, ...(path as [string, string]))))
    await assertSucceeds(getDoc(doc(db, 'runs', 'r1', 'dmOnly', 'current')))
    await assertSucceeds(setDoc(doc(db, 'characters', 'c2'), { name: 'New' }))
    await assertSucceeds(setDoc(doc(db, 'runs', 'r1'), { floor: 2 }))
    await assertSucceeds(setDoc(doc(db, 'runs', 'r1', 'players', 'c1'), { slots: [] }))
    await assertSucceeds(setDoc(doc(db, 'runs', 'r1', 'dmOnly', 'current'), { hiddenCondition: 7 }))
    await assertSucceeds(setDoc(doc(db, 'runHistory', 'h2'), { result: 'wipe' }))
  })

  it('still matches when Google reports the email with capitals', async () => {
    await assertSucceeds(getDoc(doc(as('DM@Example.com'), 'runs', 'r1', 'dmOnly', 'current')))
  })

  it('can invite and remove players', async () => {
    const db = as(DM)
    await assertSucceeds(setDoc(doc(db, 'invites', STRANGER), { role: 'player' }))
    await assertSucceeds(deleteDoc(doc(db, 'invites', OTHER_PLAYER)))
    await assertSucceeds(getDoc(doc(db, 'invites', PLAYER)))
  })

  it('cannot save an invite with a bad role or a capitalised email', async () => {
    const db = as(DM)
    await assertFails(setDoc(doc(db, 'invites', STRANGER), { role: 'admin' }))
    await assertFails(setDoc(doc(db, 'invites', 'Stranger@Example.com'), { role: 'player' }))
  })

  it('cannot delete its own invite and get locked out', async () => {
    await assertFails(deleteDoc(doc(as(DM), 'invites', DM)))
  })

  it('cannot write to collections the rules do not mention', async () => {
    await assertFails(setDoc(doc(as(DM), 'somethingElse', 'x'), { a: 1 }))
  })
})

// ---------------------------------------------------------------------------
// Players spending their own Devotions and Quantum Basalts (Phase 2).
// A level 7 character's tier cap is 15 Devotions per track.

const OWNED = 'owned'
const OTHERS = 'others'

async function seedCharacters(owned: DocumentData = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'characters', OWNED), {
      name: 'Owned',
      level: 7,
      playerEmail: PLAYER,
      bankedDevotions: 10,
      trackDevotions: { 'max-hp': 2 },
      bankedQuantumBasalts: 50,
      upgrades: { reroll: 1, 'starting-boon': 1 },
      ...owned,
    })
    await setDoc(doc(db, 'characters', OTHERS), {
      name: 'Someone else',
      level: 7,
      playerEmail: OTHER_PLAYER,
      bankedDevotions: 10,
      trackDevotions: {},
      bankedQuantumBasalts: 50,
      upgrades: {},
    })
  })
}

const now = serverTimestamp

describe('player spending Devotions', () => {
  beforeEach(() => seedCharacters())
  const owned = () => doc(as(PLAYER), 'characters', OWNED)

  it('can invest in an existing or a new track, paying exactly from the bank', async () => {
    await assertSucceeds(updateDoc(owned(), { 'trackDevotions.max-hp': 5, bankedDevotions: 7, updatedAt: now() }))
    await assertSucceeds(updateDoc(owned(), { 'trackDevotions.speed': 1, bankedDevotions: 6, updatedAt: now() }))
  })

  it('must pay exactly what it invests', async () => {
    await assertFails(updateDoc(owned(), { 'trackDevotions.max-hp': 5, updatedAt: now() }))
    await assertFails(updateDoc(owned(), { 'trackDevotions.max-hp': 5, bankedDevotions: 8, updatedAt: now() }))
    await assertFails(updateDoc(owned(), { bankedDevotions: 100, updatedAt: now() }))
  })

  it('cannot overspend the bank', async () => {
    await assertFails(updateDoc(owned(), { 'trackDevotions.max-hp': 14, bankedDevotions: -2, updatedAt: now() }))
  })

  it('stays within the tier cap for its level', async () => {
    await seedCharacters({ bankedDevotions: 20, trackDevotions: { 'max-hp': 14 } })
    await assertSucceeds(updateDoc(owned(), { 'trackDevotions.max-hp': 15, bankedDevotions: 19, updatedAt: now() }))
    await assertFails(updateDoc(owned(), { 'trackDevotions.max-hp': 16, bankedDevotions: 18, updatedAt: now() }))
  })

  it('cannot refund, touch two tracks at once, or invent a track', async () => {
    await assertFails(updateDoc(owned(), { 'trackDevotions.max-hp': 1, bankedDevotions: 11, updatedAt: now() }))
    await assertFails(
      updateDoc(owned(), { 'trackDevotions.max-hp': 3, 'trackDevotions.speed': 1, bankedDevotions: 8, updatedAt: now() }),
    )
    await assertFails(updateDoc(owned(), { 'trackDevotions.flying': 1, bankedDevotions: 9, updatedAt: now() }))
  })

  it('must stamp the server time', async () => {
    await assertFails(updateDoc(owned(), { 'trackDevotions.max-hp': 3, bankedDevotions: 9, updatedAt: new Date(0) }))
  })
})

describe('player buying upgrades', () => {
  beforeEach(() => seedCharacters())
  const owned = () => doc(as(PLAYER), 'characters', OWNED)

  it('can buy the next rank at exactly its price', async () => {
    await assertSucceeds(updateDoc(owned(), { 'upgrades.reroll': 2, bankedQuantumBasalts: 30, updatedAt: now() }))
    await assertSucceeds(updateDoc(owned(), { 'upgrades.forge': 1, bankedQuantumBasalts: 0, updatedAt: now() }))
  })

  it('cannot pay the wrong price, skip ranks or go past the max', async () => {
    await assertFails(updateDoc(owned(), { 'upgrades.reroll': 2, bankedQuantumBasalts: 49, updatedAt: now() }))
    await assertFails(updateDoc(owned(), { 'upgrades.reroll': 3, bankedQuantumBasalts: 15, updatedAt: now() }))
    await assertFails(updateDoc(owned(), { 'upgrades.starting-boon': 2, bankedQuantumBasalts: 35, updatedAt: now() }))
  })

  it('cannot afford more than its bank, or invent an upgrade', async () => {
    await assertFails(updateDoc(owned(), { 'upgrades.extra-boon-slot': 1, bankedQuantumBasalts: -10, updatedAt: now() }))
    await assertFails(updateDoc(owned(), { 'upgrades.free-stuff': 1, bankedQuantumBasalts: 50, updatedAt: now() }))
  })

  it('cannot buy two upgrades at once or refund', async () => {
    await assertFails(
      updateDoc(owned(), { 'upgrades.forge': 1, 'upgrades.reroll': 2, bankedQuantumBasalts: 0, updatedAt: now() }),
    )
    await assertFails(updateDoc(owned(), { 'upgrades.reroll': 0, bankedQuantumBasalts: 60, updatedAt: now() }))
  })
})

describe('players and characters', () => {
  beforeEach(() => seedCharacters())

  it('cannot change their own profile, banks or anything else', async () => {
    const owned = doc(as(PLAYER), 'characters', OWNED)
    await assertFails(updateDoc(owned, { level: 20, updatedAt: now() }))
    await assertFails(updateDoc(owned, { playerEmail: OTHER_PLAYER, updatedAt: now() }))
    await assertFails(updateDoc(owned, { bankedQuantumBasalts: 999, updatedAt: now() }))
    await assertFails(updateDoc(owned, { lockoutDays: 0, updatedAt: now() }))
  })

  it('cannot spend from someone else\'s character', async () => {
    const theirs = doc(as(PLAYER), 'characters', OTHERS)
    await assertFails(updateDoc(theirs, { 'trackDevotions.max-hp': 1, bankedDevotions: 9, updatedAt: now() }))
    await assertFails(updateDoc(theirs, { 'upgrades.forge': 1, bankedQuantumBasalts: 20, updatedAt: now() }))
  })

  it('cannot create or delete characters', async () => {
    await assertFails(setDoc(doc(as(PLAYER), 'characters', 'new'), { name: 'Mine', playerEmail: PLAYER }))
    await assertFails(deleteDoc(doc(as(PLAYER), 'characters', OWNED)))
  })

  it('a stranger with a matching playerEmail but no invite gets nothing', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'characters', OTHERS), { playerEmail: STRANGER }))
    await assertFails(
      updateDoc(doc(as(STRANGER), 'characters', OTHERS), { 'upgrades.forge': 1, bankedQuantumBasalts: 20, updatedAt: now() }),
    )
  })

  it('the DM can still correct anything, including refunds', async () => {
    const asDM = doc(as(DM), 'characters', OWNED)
    await assertSucceeds(updateDoc(asDM, { 'trackDevotions.max-hp': 0, bankedDevotions: 12 }))
    await assertSucceeds(updateDoc(asDM, { 'upgrades.reroll': 0, bankedQuantumBasalts: 60, level: 8 }))
  })
})

describe('the app\'s own save path (transaction with field paths)', () => {
  beforeEach(() => seedCharacters())

  it('a player\'s Devotion spend and upgrade purchase go through exactly as the app writes them', async () => {
    const db = as(PLAYER)
    const ref = doc(db, 'characters', OWNED)
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const banked = snap.data()!.bankedDevotions
        const invested = snap.data()!.trackDevotions['max-hp']
        tx.update(ref, new FieldPath('trackDevotions', 'max-hp'), invested + 3, 'bankedDevotions', banked - 3, 'updatedAt', serverTimestamp())
      }),
    )
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        tx.update(ref, new FieldPath('upgrades', 'extra-boon-slot'), 1, 'bankedQuantumBasalts', snap.data()!.bankedQuantumBasalts - 40, 'updatedAt', serverTimestamp())
      }),
    )
  })
})
