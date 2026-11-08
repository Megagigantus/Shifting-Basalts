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
import { deleteDoc, doc, getDoc, setDoc, setLogLevel } from 'firebase/firestore'

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
