// Pure helpers for Caretaker-9 dispatches, due checks, and ad-hoc answer cards.
// Browser-safe: no Firebase, React, or Node imports. Never logs card text or questions.
import type { LoreCard, LoreTier } from './types'

export type DispatchStatus = 'pending' | 'answered'

export interface LoreDispatch {
  id: string
  question: string
  runId: string
  floor: number
  status: DispatchStatus
  createdAtMs: number
  answerCardId?: string
}

export interface AdHocAnswerFields {
  question: string
  title: string
  readAloud: string
  push: string
  dmTruth: string
  tier: LoreTier
}

const ADHOC_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const ADHOC_ID_LENGTH = 8
const LABEL_MAX_CHARS = 120

function toTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  ) {
    const ms = (value as { toMillis: () => unknown }).toMillis()
    if (typeof ms === 'number' && Number.isFinite(ms)) return ms
  }
  return null
}

/** Map a Firestore `loreDispatches` document into a `LoreDispatch` safely. */
export function dispatchFromDoc(id: string, data: Record<string, unknown>): LoreDispatch {
  const status: DispatchStatus = data.status === 'answered' ? 'answered' : 'pending'
  const dispatch: LoreDispatch = {
    id,
    question: typeof data.question === 'string' ? data.question : '',
    runId: typeof data.runId === 'string' ? data.runId : '',
    floor: typeof data.floor === 'number' && Number.isFinite(data.floor) ? data.floor : 0,
    status,
    createdAtMs: toTimestampMs(data.createdAtMs) ?? toTimestampMs(data.createdAt) ?? 0,
  }
  if (typeof data.answerCardId === 'string') {
    dispatch.answerCardId = data.answerCardId
  }
  return dispatch
}

/** Return the dispatch already sent for a given run and floor, if any. */
export function askedThisRoom(
  dispatches: readonly LoreDispatch[],
  runId: string,
  floor: number,
): LoreDispatch | null {
  return dispatches.find((d) => d.runId === runId && d.floor === floor) ?? null
}

/**
 * Return pending dispatches for a run that are due an answer, oldest first:
 * all pending dispatches when the run has ended, or those from earlier floors while active.
 */
export function dueDispatches(
  dispatches: readonly LoreDispatch[],
  runId: string,
  currentFloor: number,
  runEnded: boolean,
): LoreDispatch[] {
  return dispatches
    .filter(
      (d) =>
        d.runId === runId &&
        d.status === 'pending' &&
        (runEnded || d.floor < currentFloor),
    )
    .sort((a, b) => {
      if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs
      if (a.floor !== b.floor) return a.floor - b.floor
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
}

/** Build an ad-hoc dispatch answer card that never counts toward the full-collection laurel. */
export function adHocAnswerCard(
  { question, title, readAloud, push, dmTruth, tier }: AdHocAnswerFields,
  newId: string,
): LoreCard {
  const trimmed = question.trim()
  const rawLabel = trimmed ? `Answer to: ${trimmed}` : 'Answer to:'
  const label = rawLabel.slice(0, LABEL_MAX_CHARS).trim()

  return {
    id: newId,
    group: 'dispatch',
    title,
    trigger: { key: 'dispatch', label },
    repeat: 'repeatable',
    tier,
    source: 'loremaster',
    readAloud,
    push,
    dmTruth,
    placeholders: [],
    imageUrl: null,
    adHoc: true,
  }
}

/** Generate an ad-hoc dispatch card id of the form `dis-adhoc-` + 8 lowercase letters/digits. */
export function newAdHocId(random: () => number = Math.random): string {
  let suffix = ''
  for (let i = 0; i < ADHOC_ID_LENGTH; i += 1) {
    const rawIndex = Math.floor(random() * ADHOC_ID_ALPHABET.length)
    const index = Math.min(ADHOC_ID_ALPHABET.length - 1, Math.max(0, rawIndex))
    suffix += ADHOC_ID_ALPHABET[index]
  }
  return `dis-adhoc-${suffix}`
}
