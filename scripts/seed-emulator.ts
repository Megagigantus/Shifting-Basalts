// Seeds the local Firebase emulators for `npm run dev:local`, so local test
// mode has a DM and a player to sign in as. Only ever talks to the emulators
// on this computer (the "demo-" project can't reach real Firebase).
//
// Test logins for local mode only (they don't exist anywhere else):
//   DM:     dm@example.com      / local-test-dm
//   Player: player@example.com  / local-test-player
//
// Emails the emulator "sends" (verification, password reset) aren't delivered;
// list their links with: curl http://127.0.0.1:9099/emulator/v1/projects/demo-shifting-basalts/oobCodes
const PROJECT = 'demo-shifting-basalts'
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'}`
const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080'}`
// "owner" is the emulators' admin token: it skips security rules.
const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }

const accounts = [
  { email: 'dm@example.com', password: 'local-test-dm', role: 'dm' },
  { email: 'player@example.com', password: 'local-test-player', role: 'player' },
]

async function call(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`${method} ${url} failed: ${response.status} ${await response.text()}`)
  return response.json()
}

for (const a of accounts) {
  await call(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, 'POST', {
    email: a.email,
    password: a.password,
    emailVerified: true,
  })
  await call(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/invites/${encodeURIComponent(a.email)}`,
    'PATCH',
    { fields: { role: { stringValue: a.role } } },
  )
}

// Two ready-made characters, so drafts can be tried straight away.
type Value = string | number | boolean | null | Value[] | { [key: string]: Value }
function toFirestore(value: Value): unknown {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestore) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toFirestore(v)])) } }
}

const dungeonLayer = {
  bankedQuantumBasalts: 0,
  bankedDevotions: 0,
  trackDevotions: {},
  deepestFloor: 0,
  lockoutDays: 0,
  banished: [],
  attuneTag: null,
}
const characters: Record<string, { [key: string]: Value }> = {
  'test-fighter': {
    name: 'Test Fighter',
    playerEmail: 'player@example.com',
    classId: 'fighter',
    subclass: 'Champion',
    level: 5,
    casterType: 'none',
    slotLevels: [],
    hasSummon: false,
    attackStyle: 'melee',
    ...dungeonLayer,
    upgrades: {
      reroll: 1,
      'starting-boon': 1,
      forge: 1,
      banish: 1,
      attunement: 1,
      'hidden-sight': 1,
      reprieve: 4,
      // Unlocks Restless Stone, Heavy Crown and the harsher Pressures for testing.
      'extra-pressures': 2,
      'healing-font': 1,
    },
  },
  'test-wizard': {
    name: 'Test Wizard',
    // Also the test player's, so slot recovery can be spent from their device.
    playerEmail: 'player@example.com',
    classId: 'wizard',
    subclass: 'Evoker',
    level: 5,
    casterType: 'full',
    slotLevels: [1, 2, 3],
    hasSummon: false,
    attackStyle: 'spells',
    ...dungeonLayer,
    // Spell slot recovery rank 5 (15 Devotions), and a second Healing Font owner.
    trackDevotions: { 'spell-slot-recovery': 15 },
    upgrades: { 'healing-font': 1 },
  },
}
for (const [id, data] of Object.entries(characters)) {
  await call(`${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/characters/${id}`, 'PATCH', {
    fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFirestore(v)])),
  })
}

console.log(
  `Seeded local emulators: ${accounts.map((a) => `${a.email} (${a.role})`).join(', ')}; characters: ${Object.keys(characters).join(', ')}`,
)
