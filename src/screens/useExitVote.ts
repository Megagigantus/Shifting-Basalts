// A player's Descend/Extract ballot: their living characters' shared vote
// and the actions that cast it (all at once from the post-boss cards, or one
// character at a time).
import { useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import { partyVote, type ExitVote, type ExitVoteDoc } from '../rules/votes'
import { setExitVote } from '../runStore'

export interface ExitBallot {
  current: ExitVote | null
  castAll: (vote: ExitVote) => Promise<void>
  castOne: (characterId: string, vote: ExitVote) => Promise<void>
  sending: boolean
  error: string | null
}

/** Shared vote state and actions for a player's living characters. */
export function useExitVote(
  state: RunState,
  mine: RunPlayer[],
  votes: Record<string, ExitVoteDoc>,
  readOnly: boolean,
): ExitBallot {
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const { run } = state
  const livingIds = mine.filter((p) => p.alive).map((p) => p.characterId)
  const current = partyVote(livingIds, votes, run.floor)

  const save = async (task: () => Promise<void>) => {
    if (readOnly) return
    setError(null)
    setSending(true)
    try {
      await task()
    } catch {
      setError('Could not send your vote. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  const castOne = (characterId: string, vote: ExitVote) =>
    save(() => setExitVote(run.id, characterId, vote, run.floor))

  const castAll = (vote: ExitVote) =>
    save(async () => {
      if (livingIds.length === 0) return
      await Promise.all(livingIds.map((id) => setExitVote(run.id, id, vote, run.floor)))
    })

  return { current, castAll, castOne, sending, error }
}
