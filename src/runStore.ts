// Loading and saving runs in Firestore.
//   runs/{runId}                  the run
//   runs/{runId}/players/{charId} each player's run state
//   runs/{runId}/choices/{charId} a player's pending draft choice
//   runHistory/{runId}            summary written when a run ends
import { useEffect, useState } from 'react'
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Character } from './model/character'
import type { DmRunState, Run, RunPlayer, RunResult, RunState } from './model/run'
import { spendHiddenSight } from './rules/roomFlow'
import { runResults } from './rules/runFlow'
import { applyChoice, draftKey, isDraftChoice, type DraftChoice } from './rules/draftChoice'

/**
 * Live view of the run currently in progress, if any. Only the DM's screen
 * passes includeDm, which also loads the DM-only part (floor plan and full
 * room); players' screens never ask for it, and the rules would refuse anyway.
 */
export function useActiveRun(includeDm = false): { state: RunState | null; loading: boolean; error: string | null } {
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

  const [dmLoaded, setDmLoaded] = useState<{ runId: string; dm: DmRunState | null } | null>(null)
  useEffect(() => {
    if (!db || !runId || !includeDm) return
    return onSnapshot(doc(db, 'runs', runId, 'dmOnly', 'room'), (snap) =>
      setDmLoaded({ runId, dm: snap.exists() ? (snap.data() as DmRunState) : null }),
    )
  }, [runId, includeDm])
  const dm = dmLoaded && dmLoaded.runId === runId ? dmLoaded.dm : null

  const state =
    run && players
      ? {
          run,
          // Keep the party in the order they were picked.
          players: run.characterIds
            .map((id) => players.find((p) => p.characterId === id))
            .filter((p): p is RunPlayer => Boolean(p)),
          ...(dm ? { dm } : {}),
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
  // The DM-only part (floor plan and full room), when it changed.
  if (next.dm && (!previous?.dm || !same(previous.dm, next.dm))) {
    batch.set(doc(db, 'runs', id, 'dmOnly', 'room'), next.dm)
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
        ...(r.loot.length ? { loot: arrayUnion(...r.loot.map((item) => ({ ...item, runId: id }))) } : {}),
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
      lootShare: next.run.lootShare ?? null,
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
  /** Forge uses: what to do, and to which slot or Combination. */
  forgeKind?: 'level' | 'evolve' | 'combine'
  slotIndex?: number
  combinationId?: string
  /** Thils's Vault: the relic taken. */
  relicId?: string
  /** Slot recovery: the spell slot level to recover. */
  slotLevel?: number
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
  if (choice.action === 'relic') data.relicId = choice.relicId
  if (choice.action === 'recover') data.slotLevel = choice.slotLevel
  if (choice.action === 'forge') {
    data.forgeKind = choice.forge.kind
    if (choice.forge.kind === 'combine') data.combinationId = choice.forge.combinationId
    else data.slotIndex = choice.forge.slotIndex
  }
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
    case 'relic':
      return { action: 'relic', relicId: c.relicId ?? '' }
    case 'recover':
      return { action: 'recover', slotLevel: c.slotLevel ?? 0 }
    case 'forge':
      return {
        action: 'forge',
        forge:
          c.forgeKind === 'combine'
            ? { kind: 'combine', combinationId: c.combinationId ?? '' }
            : { kind: c.forgeKind === 'evolve' ? 'evolve' : 'level', slotIndex: c.slotIndex ?? -1 },
      }
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
  // A draft or hidden-offer answer with nothing left to answer (e.g. the DM
  // already picked for them): just clear it.
  if (parsed.action === 'hiddenSight') {
    await applyHiddenSight(state, characterId, choiceRef)
    return
  }
  // Only boon draft and hidden-offer answers depend on an open offer.
  const answersOffer = ['take', 'pass', 'reroll', 'hidden', 'passHidden'].includes(parsed.action)
  if (player && answersOffer && !player.draft && !player.hiddenOffer) {
    await deleteDoc(choiceRef)
    return
  }
  let next: RunState
  try {
    if (!player) throw new Error('That character isn\'t in this run.')
    if (isDraftChoice(parsed) && choice.draftKey !== draftKey(player)) {
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
  // Forge uses also change the run (uses left).
  if (!same(state.run, next.run)) {
    const { id, ...runData } = next.run
    batch.set(doc(db, 'runs', id), { ...runData, updatedAt: serverTimestamp() }, { merge: true })
  }
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
    batch.delete(doc(db, 'runs', state.run.id, 'requests', player.characterId))
    batch.update(doc(db, 'characters', player.characterId), { activeRunId: null, updatedAt: serverTimestamp() })
  }
  batch.delete(doc(db, 'runs', state.run.id, 'dmOnly', 'room'))
  batch.delete(doc(db, 'runs', state.run.id))
  await batch.commit()
}

// ---------------------------------------------------------------------------
// Run history: runHistory/{runId}, written when a run ends (saveRunState).

export interface RunHistoryEntry {
  id: string
  status: RunState['run']['status']
  partyLevel: number
  partySize: number
  pressures: string[]
  floorReached: number
  lastBossFloor: number
  lootKeptPercent: number | null
  lootShare?: RunState['run']['lootShare']
  rooms: { floor: number; room: number; kind: string }[]
  results: RunResult[]
  endedAt: Date | null
}

/** The latest finished runs, newest first. */
export function useRunHistory(max = 50): { entries: RunHistoryEntry[] | null; error: string | null } {
  const [entries, setEntries] = useState<RunHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!db) return
    return onSnapshot(
      query(collection(db, 'runHistory'), orderBy('endedAt', 'desc'), limit(max)),
      (snapshot) =>
        setEntries(
          snapshot.docs.map((d) => {
            const data = d.data()
            return { ...(data as Omit<RunHistoryEntry, 'id' | 'endedAt'>), id: d.id, endedAt: data.endedAt?.toDate?.() ?? null }
          }),
        ),
      () => setError('Could not load run history.'),
    )
  }, [max])
  return { entries, error }
}

// ---------------------------------------------------------------------------
// Loot requests: runs/{runId}/requests/{characterId} lists the pool items a
// player would like at extraction. The DM decides; this is only a wish list.

/** A player sets the items they'd like from the party's loot. */
export async function setLootRequests(runId: string, characterId: string, uids: string[]) {
  if (!db) throw new Error('Firebase is not set up.')
  await setDoc(doc(db, 'runs', runId, 'requests', characterId), { uids, updatedAt: serverTimestamp() })
}

/** Live map of characterId -> requested item uids for a run. */
export function useLootRequests(runId: string | null): Record<string, string[]> {
  const [loaded, setLoaded] = useState<{ runId: string; requests: Record<string, string[]> } | null>(null)
  useEffect(() => {
    if (!db || !runId) return
    return onSnapshot(collection(db, 'runs', runId, 'requests'), (snapshot) => {
      const requests: Record<string, string[]> = {}
      for (const d of snapshot.docs) requests[d.id] = (d.data().uids as string[]) ?? []
      setLoaded({ runId, requests })
    })
  }, [runId])
  return loaded && loaded.runId === runId ? loaded.requests : {}
}

// ---------------------------------------------------------------------------
// Battle map tokens: runs/{runId}/tokens/{characterId} holds where a player's
// token stands, and in which room ("floor-room"). A token from an earlier
// room counts as not placed, so it starts at the entrance again.

export interface TokenSpot {
  x: number
  y: number
  roomKey: string
}

/** The key that ties a token to the room it was moved in. */
export const roomKeyOf = (view: { floor: number; room: number }) => `${view.floor}-${view.room}`

/** Move a character's token (the owning player, or the DM). */
export async function moveToken(runId: string, characterId: string, x: number, y: number, roomKey: string) {
  if (!db) throw new Error('Firebase is not set up.')
  await setDoc(doc(db, 'runs', runId, 'tokens', characterId), {
    x: Math.round(x),
    y: Math.round(y),
    roomKey,
    updatedAt: serverTimestamp(),
  })
}

/** Live map of characterId -> token spot for a run. */
export function useTokens(runId: string | null): Record<string, TokenSpot> {
  const [loaded, setLoaded] = useState<{ runId: string; tokens: Record<string, TokenSpot> } | null>(null)
  useEffect(() => {
    if (!db || !runId) return
    return onSnapshot(collection(db, 'runs', runId, 'tokens'), (snapshot) => {
      const tokens: Record<string, TokenSpot> = {}
      for (const d of snapshot.docs) {
        const data = d.data()
        tokens[d.id] = { x: data.x as number, y: data.y as number, roomKey: data.roomKey as string }
      }
      setLoaded({ runId, tokens })
    })
  }, [runId])
  return loaded && loaded.runId === runId ? loaded.tokens : {}
}

// ---------------------------------------------------------------------------
// Hidden Sight: runs/{runId}/private/{characterId} holds a player's hints,
// readable only by that player and the DM.

export interface PrivateHint {
  floor: number
  room: number
  hint: string
}

/**
 * Spend a player's Hidden Sight on the current room: mark it used and write
 * the hint where only they (and the DM) can read it. `choiceRef`, if given,
 * is the player's request, cleared on success or marked with the error.
 */
export async function applyHiddenSight(
  state: RunState,
  characterId: string,
  choiceRef?: ReturnType<typeof doc>,
): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  let result: ReturnType<typeof spendHiddenSight>
  try {
    result = spendHiddenSight(state, characterId)
  } catch (err) {
    if (choiceRef) await updateDoc(choiceRef, { error: (err as Error).message })
    else throw err
    return
  }
  const batch = writeBatch(db)
  const updated = result.state.players.find((p) => p.characterId === characterId)!
  batch.set(doc(db, 'runs', state.run.id, 'players', characterId), updated)
  const hint: PrivateHint = { floor: state.run.floor, room: state.run.room, hint: result.hint }
  batch.set(doc(db, 'runs', state.run.id, 'private', characterId), { hints: arrayUnion(hint) }, { merge: true })
  if (choiceRef) batch.delete(choiceRef)
  await batch.commit()
}

/** A player's own Hidden Sight hints for this run (players read only their own). */
export function usePrivateHints(runId: string | null, characterId: string | null): PrivateHint[] {
  const [loaded, setLoaded] = useState<{ key: string; hints: PrivateHint[] } | null>(null)
  const key = `${runId}/${characterId}`
  useEffect(() => {
    if (!db || !runId || !characterId) return
    return onSnapshot(
      doc(db, 'runs', runId, 'private', characterId),
      (snap) => setLoaded({ key: `${runId}/${characterId}`, hints: (snap.data()?.hints as PrivateHint[]) ?? [] }),
      () => setLoaded({ key: `${runId}/${characterId}`, hints: [] }),
    )
  }, [runId, characterId])
  return loaded && loaded.key === key ? loaded.hints : []
}
