// The DM's JSON backup: a download of everything the app stores in Firestore
// (characters, invites, run history, and any run with all its parts), so a
// copy can live outside the cloud. Download only; restoring is a later step
// (docs/ui-redesign-plan.md).
import { collection, getDocs, type Firestore } from 'firebase/firestore'

/** Every part of a run, stored under runs/{runId}/... */
const RUN_PARTS = ['players', 'choices', 'requests', 'tokens', 'private', 'dmOnly'] as const

export interface Backup {
  app: 'shifting-basalts'
  version: 1
  exportedAt: string
  characters: Record<string, unknown>
  invites: Record<string, unknown>
  runHistory: Record<string, unknown>
  runs: Record<string, { data: unknown; parts: Record<string, Record<string, unknown>> }>
}

/**
 * Plain JSON from Firestore data: timestamps (anything with toDate()) become
 * ISO date strings, everything else is copied as is.
 */
export function toPlain(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  const maybe = value as { toDate?: () => Date }
  if (typeof maybe.toDate === 'function') return maybe.toDate().toISOString()
  if (Array.isArray(value)) return value.map(toPlain)
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]))
}

async function readCollection(db: Firestore, ...path: [string, ...string[]]): Promise<Record<string, unknown>> {
  const snap = await getDocs(collection(db, ...path))
  return Object.fromEntries(snap.docs.map((d) => [d.id, toPlain(d.data())]))
}

export async function buildBackup(db: Firestore, now = new Date()): Promise<Backup> {
  const [characters, invites, runHistory, runsSnap] = await Promise.all([
    readCollection(db, 'characters'),
    readCollection(db, 'invites'),
    readCollection(db, 'runHistory'),
    getDocs(collection(db, 'runs')),
  ])
  const runs: Backup['runs'] = {}
  for (const run of runsSnap.docs) {
    const parts: Record<string, Record<string, unknown>> = {}
    for (const part of RUN_PARTS) parts[part] = await readCollection(db, 'runs', run.id, part)
    runs[run.id] = { data: toPlain(run.data()), parts }
  }
  return { app: 'shifting-basalts', version: 1, exportedAt: now.toISOString(), characters, invites, runHistory, runs }
}

/** File name like shifting-basalts-backup-2026-11-14.json (local date). */
export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `shifting-basalts-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}

/** Build the backup and hand it to the browser as a download. */
export async function downloadBackup(db: Firestore): Promise<void> {
  const now = new Date()
  const backup = await buildBackup(db, now)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(now)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
