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

console.log(`Seeded local emulators: ${accounts.map((a) => `${a.email} (${a.role})`).join(', ')}`)
