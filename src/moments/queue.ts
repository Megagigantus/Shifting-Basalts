import { THEME } from './theme'
import type { Moment, MomentStatus, MomentViewer } from './types'

const MAX_SEEN_IDS = 100

/** A moment currently on screen, along with whether it was skipped. */
export interface PlayingMoment {
  moment: Moment
  skipped: boolean
}

/** Pure playback state for one screen's moment queue. */
export interface QueueState {
  current: PlayingMoment | null
  waiting: Moment[]
  seen: string[]
}

/** Initial empty queue state. */
export const EMPTY_QUEUE: QueueState = {
  current: null,
  waiting: [],
  seen: [],
}

/** Actions processed by {@link reduceQueue}. */
export type QueueAction =
  | { type: 'arrive'; moment: Moment; nowMs: number; maxAgeMs?: number }
  | { type: 'status'; id: string; status: MomentStatus }
  | { type: 'finish'; id: string }

/**
 * True if a moment's timestamp is still within the freshness window.
 * Pending local timestamps (`null`) and minor future clock skew count as fresh.
 */
export function isFresh(
  createdAtMs: number | null,
  nowMs: number,
  maxAgeMs: number = THEME.playback.maxMomentAgeMs,
): boolean {
  if (createdAtMs === null) return true
  return nowMs - createdAtMs <= maxAgeMs
}

/** True if a moment is meant to play on the given viewer screen. */
export function inAudience(moment: Pick<Moment, 'audience'>, viewer: MomentViewer): boolean {
  if (viewer.kind === 'dm') return true
  if (viewer.kind === 'table') return moment.audience.table
  const { players } = moment.audience
  if (players === 'all') return true
  if (players === 'none') return false
  return players.some((id) => viewer.characterIds.includes(id))
}

function appendSeen(seen: string[], id: string): string[] {
  const next = [...seen, id]
  return next.length > MAX_SEEN_IDS ? next.slice(-MAX_SEEN_IDS) : next
}

/** Pure reducer advancing a screen's moment queue without mutating inputs. */
export function reduceQueue(state: QueueState, action: QueueAction): QueueState {
  if (action.type === 'arrive') {
    const { moment, nowMs, maxAgeMs } = action
    if (state.seen.includes(moment.id)) return state
    if (moment.status !== 'playing') return state
    if (!isFresh(moment.createdAtMs, nowMs, maxAgeMs)) return state

    const seen = appendSeen(state.seen, moment.id)
    if (state.current === null) {
      return {
        current: { moment, skipped: false },
        waiting: state.waiting,
        seen,
      }
    }
    return {
      current: state.current,
      waiting: [...state.waiting, moment],
      seen,
    }
  }

  if (action.type === 'status') {
    if (action.status === 'playing') return state
    if (state.current?.moment.id === action.id) {
      if (state.current.skipped) return state
      return {
        current: { ...state.current, skipped: true },
        waiting: state.waiting,
        seen: state.seen,
      }
    }
    if (state.waiting.some((m) => m.id === action.id)) {
      return {
        current: state.current,
        waiting: state.waiting.filter((m) => m.id !== action.id),
        seen: state.seen,
      }
    }
    return state
  }

  if (state.current?.moment.id === action.id) {
    const [next, ...rest] = state.waiting
    return {
      current: next ? { moment: next, skipped: false } : null,
      waiting: rest,
      seen: state.seen,
    }
  }
  return state
}

/**
 * Convert Firestore snapshot doc changes into queue actions.
 * Ignores the initial snapshot so late joiners never replay old moments.
 */
export function arrivalsFromChanges(
  changes: { type: 'added' | 'modified' | 'removed'; moment: Moment }[],
  isFirstSnapshot: boolean,
  nowMs: number,
): QueueAction[] {
  if (isFirstSnapshot) return []
  const actions: QueueAction[] = []
  for (const change of changes) {
    if (change.type === 'added') {
      actions.push({ type: 'arrive', moment: change.moment, nowMs })
    } else if (change.type === 'modified') {
      actions.push({ type: 'status', id: change.moment.id, status: change.moment.status })
    }
  }
  return actions
}
