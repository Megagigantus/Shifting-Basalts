// Loading and saving runs in Firestore.
//   runs/{runId}                  the run
//   runs/{runId}/players/{charId} each player's run state
//   runHistory/{runId}            summary written when a run ends
import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Character } from './model/character'
import type { Run, RunPlayer, RunResult, RunState } from './model/run'
import { runResults } from './rules/runFlow'

/** Live view of the run currently in progress, if any. */
export function useActiveRun(): { state: RunState | null; loading: boolean; error: string | null } {
  const [run, setRun] = useState<Run | null>(null)
  // Players are tagged with the run they belong to, so a stale list from a
  // previous run is never shown against a new one.
  const [loaded, setLoaded] = useState<{ runId: string; players: RunPlayer[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) return
    const active = query(collection(db, 'runs'), where('status', '==', 'active'), limit(1))
    return onSnapshot(
      active,
      (snapshot) => {
        const found = snapshot.docs[0]
        setRun(found ? ({ ...found.data(), id: found.id } as Run) : null)
        setLoading(false)
      },
      () => {
        setError('Could not load the current run.')
        setLoading(false)
      },
    )
  }, [])

  const runId = run?.id
  useEffect(() => {
    if (!db || !runId) return
    return onSnapshot(
      collection(db, 'runs', runId, 'players'),
      (snapshot) => setLoaded({ runId, players: snapshot.docs.map((d) => d.data() as RunPlayer) }),
      () => setError('Could not load the party.'),
    )
  }, [runId])

  const players = loaded && loaded.runId === runId ? loaded.players : null

  const state =
    run && players
      ? {
          run,
          // Keep the party in the order they were picked.
          players: run.characterIds
            .map((id) => players.find((p) => p.characterId === id))
            .filter((p): p is RunPlayer => Boolean(p)),
        }
      : null
  return { state, loading: loading || Boolean(run && !players), error }
}

/** A fresh id for a new run document. */
export function newRunId(): string {
  if (!db) throw new Error('Firebase is not set up.')
  return doc(collection(db, 'runs')).id
}

/**
 * Save a run's new state. If this step ended the run, the same batch also
 * applies each character's results and writes the run history, so it all
 * succeeds or fails together.
 */
export async function saveRunState(
  next: RunState,
  previous: RunState | null,
  characters: Character[],
): Promise<RunResult[] | null> {
  if (!db) throw new Error('Firebase is not set up.')
  const batch = writeBatch(db)
  const { id, ...runData } = next.run
  batch.set(doc(db, 'runs', id), { ...runData, updatedAt: serverTimestamp() }, { merge: true })
  for (const player of next.players) {
    batch.set(doc(db, 'runs', id, 'players', player.characterId), player)
  }

  const justEnded = next.run.status !== 'active' && (previous === null || previous.run.status === 'active')
  let results: RunResult[] | null = null
  if (justEnded) {
    results = runResults(next)
    for (const r of results) {
      const character = characters.find((c) => c.id === r.characterId)
      batch.update(doc(db, 'characters', r.characterId), {
        bankedQuantumBasalts: increment(r.quantumBasaltsGained),
        bankedDevotions: increment(r.devotions),
        deepestFloor: Math.max(character?.deepestFloor ?? 0, r.deepestFloor),
        ...(r.lockoutDays !== null ? { lockoutDays: r.lockoutDays } : {}),
        updatedAt: serverTimestamp(),
      })
    }
    batch.set(doc(db, 'runHistory', id), {
      status: next.run.status,
      partyLevel: next.run.partyLevel,
      partySize: next.run.partySize,
      pressures: next.run.pressures,
      floorReached: next.run.floor,
      lastBossFloor: next.run.lastBossFloor,
      lootKeptPercent: next.run.lootKeptPercent,
      rooms: next.run.log,
      results,
      endedAt: serverTimestamp(),
    })
  }

  await batch.commit()
  return results
}

/** Throw away a run without applying any results (for mistakes and test runs). */
export async function cancelRun(state: RunState): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const batch = writeBatch(db)
  for (const player of state.players) {
    batch.delete(doc(db, 'runs', state.run.id, 'players', player.characterId))
  }
  batch.delete(doc(db, 'runs', state.run.id))
  await batch.commit()
}
