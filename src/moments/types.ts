/** Lifecycle status of a moment document in Firestore. */
export type MomentStatus = 'playing' | 'skipped' | 'done'

/** Which connected screens should play a moment. */
export interface MomentAudience {
  players: 'all' | 'none' | string[]
  table: boolean
}

/** Client-side representation of a synchronized cinematic moment. */
export interface Moment<P = Record<string, unknown>> {
  id: string
  type: string
  payload: P
  audience: MomentAudience
  createdAtMs: number | null
  createdBy: string
  status: MomentStatus
}

/** Input fields supplied when creating a new moment. */
export interface NewMoment<P = Record<string, unknown>> {
  type: string
  payload: P
  audience: MomentAudience
}

/** Identifies the screen evaluating whether a moment applies to it. */
export type MomentViewer =
  | { kind: 'player'; characterIds: string[] }
  | { kind: 'table' }
  | { kind: 'dm' }
