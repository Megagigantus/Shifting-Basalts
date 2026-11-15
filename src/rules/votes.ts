// Descend or extract: after a boss, each living player votes on their device
// and the DM sees the tally. The DM still makes the call with the Descend and
// Extract buttons; votes only inform it. A vote counts only for the floor it
// was cast on, so last floor's votes never carry over.
import type { RunState } from '../model/run'

export type ExitVote = 'descend' | 'extract'

/** One stored vote: runs/{runId}/votes/{characterId}. */
export interface ExitVoteDoc {
  vote: ExitVote
  /** The floor whose boss the party just beat. */
  floor: number
}

export interface VoteTally {
  descend: string[]
  extract: string[]
  /** Living players who haven't voted on this floor yet. */
  waiting: string[]
}

/** Whether the party is choosing right now (after a boss below floor 5). */
export function votingOpen(state: RunState): boolean {
  return state.run.status === 'active' && state.run.awaitingChoice && state.run.floor < 5
}

/** Living players' names by vote for the current floor, plus who hasn't voted. */
export function tallyVotes(state: RunState, votes: Record<string, ExitVoteDoc>): VoteTally {
  const tally: VoteTally = { descend: [], extract: [], waiting: [] }
  for (const p of state.players.filter((pl) => pl.alive)) {
    const v = votes[p.characterId]
    if (v && v.floor === state.run.floor) tally[v.vote].push(p.name)
    else tally.waiting.push(p.name)
  }
  return tally
}

/** The vote all given characters share on this floor, or null if empty, incomplete or split. */
export function partyVote(characterIds: string[], votes: Record<string, ExitVoteDoc>, floor: number): ExitVote | null {
  if (characterIds.length === 0) return null
  let shared: ExitVote | null = null
  for (const id of characterIds) {
    const v = votes[id]
    if (!v || v.floor !== floor) return null
    if (shared === null) shared = v.vote
    else if (shared !== v.vote) return null
  }
  return shared
}
