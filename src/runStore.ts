// Loading and saving runs in Firestore.
//   runs/{runId}                  the run
//   runs/{runId}/players/{charId} each player's run state
//   runs/{runId}/choices/{charId} a player's pending draft choice
//   runHistory/{runId}            summary written when a run ends
import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Character } from './model/character'
import type { Run, RunPlayer, RunResult, RunState } from './model/run'
import { runResults } from './rules/runFlow'
import { applyChoice, draftKey, isHiddenChoice, type DraftChoice } from './rules/draftChoice'

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
  // Only write what changed, so a save never overwrites a player's choice
  // that another device applied a moment earlier.
  if (!previous || !same(previous.run, next.run)) {
    batch.set(doc(db, 'runs', id), { ...runData, updatedAt: serverTimestamp() }, { merge: true })
  }
  for (const player of next.players) {
    const before = previous?.players.find((p) => p.characterId === player.characterId)
    if (!before || !same(before, player)) {
      batch.set(doc(db, 'runs', id, 'players', player.characterId), player)
    }
  }

  // A new run locks its characters' Banish and Attunement until it ends.
  if (previous === null && next.run.status === 'active') {
    for (const characterId of next.run.characterIds) {
      batch.update(doc(db, 'characters', characterId), { activeRunId: id, updatedAt: serverTimestamp() })
    }
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
        activeRunId: null,
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

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ---------------------------------------------------------------------------
// Player draft choices: runs/{runId}/choices/{characterId}
// A player's device writes only this small note; the DM's app applies it with
// the draft rules and then deletes it (or marks it with an error).

export interface ChoiceDoc {
  action: DraftChoice['action']
  index?: number
  replaceSlot?: number | null
  hiddenBoonId?: string
  /** The offer this choice was made against (null for hidden-offer choices). */
  draftKey: string | null
  /** Set by the DM's app when the choice couldn't be applied. */
  error?: string
}

/** A player sends their draft choice. */
export async function submitChoice(runId: string, characterId: string, choice: DraftChoice, key: string | null) {
  if (!db) throw new Error('Firebase is not set up.')
  const data: Record<string, unknown> = { action: choice.action, draftKey: key, createdAt: serverTimestamp() }
  if (choice.action === 'take') {
    data.index = choice.index
    data.replaceSlot = choice.replaceSlot ?? null
  }
  if (choice.action === 'hidden') data.hiddenBoonId = choice.hiddenBoonId
  await setDoc(doc(db, 'runs', runId, 'choices', characterId), data)
}

/** A player takes back a choice that hasn't been applied yet. */
export async function cancelChoice(runId: string, characterId: string) {
  if (!db) throw new Error('Firebase is not set up.')
  await deleteDoc(doc(db, 'runs', runId, 'choices', characterId))
}

/** Live map of characterId -> pending choice for a run. */
export function useChoices(runId: string | null): Record<string, ChoiceDoc> {
  const [loaded, setLoaded] = useState<{ runId: string; choices: Record<string, ChoiceDoc> } | null>(null)
  useEffect(() => {
    if (!db || !runId) return
    return onSnapshot(collection(db, 'runs', runId, 'choices'), (snapshot) => {
      const choices: Record<string, ChoiceDoc> = {}
      for (const d of snapshot.docs) choices[d.id] = d.data() as ChoiceDoc
      setLoaded({ runId, choices })
    })
  }, [runId])
  return loaded && loaded.runId === runId ? loaded.choices : {}
}

function choiceFromDoc(c: ChoiceDoc): DraftChoice {
  switch (c.action) {
    case 'take':
      return { action: 'take', index: c.index ?? -1, replaceSlot: c.replaceSlot ?? null }
    case 'hidden':
      return { action: 'hidden', hiddenBoonId: c.hiddenBoonId ?? '' }
    default:
      return { action: c.action }
  }
}

/**
 * DM's app: apply one player's pending choice. Saves the changed player and
 * deletes the choice together; if the choice is stale or not allowed, marks
 * it with an error the player can see instead.
 */
export async function applyChoiceDoc(state: RunState, characterId: string, choice: ChoiceDoc): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const choiceRef = doc(db, 'runs', state.run.id, 'choices', characterId)
  const player = state.players.find((p) => p.characterId === characterId)
  const parsed = choiceFromDoc(choice)
  // Nothing left to choose (e.g. the DM already picked for them): just clear it.
  if (player && !player.draft && !player.hiddenOffer) {
    await deleteDoc(choiceRef)
    return
  }
  let next: RunState
  try {
    if (!player) throw new Error('That character isn\'t in this run.')
    if (!isHiddenChoice(parsed) && choice.draftKey !== draftKey(player)) {
      throw new Error('Your offer changed before your choice arrived. Please choose again.')
    }
    next = applyChoice(state, characterId, parsed, Math.random)
  } catch (err) {
    await updateDoc(choiceRef, { error: (err as Error).message })
    return
  }
  const batch = writeBatch(db)
  const updated = next.players.find((p) => p.characterId === characterId)!
  batch.set(doc(db, 'runs', state.run.id, 'players', characterId), updated)
  batch.delete(choiceRef)
  await batch.commit()
}

/** Throw away a run without applying any results (for mistakes and test runs). */
export async function cancelRun(state: RunState): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const batch = writeBatch(db)
  for (const player of state.players) {
    batch.delete(doc(db, 'runs', state.run.id, 'players', player.characterId))
    batch.delete(doc(db, 'runs', state.run.id, 'choices', player.characterId))
    batch.update(doc(db, 'characters', player.characterId), { activeRunId: null, updatedAt: serverTimestamp() })
  }
  batch.delete(doc(db, 'runs', state.run.id))
  await batch.commit()
}
