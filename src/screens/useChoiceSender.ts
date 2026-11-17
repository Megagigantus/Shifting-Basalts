// Sends a player's choice (draft pick, Forge use, and so on) to the DM's app,
// or applies it straight away in the DM's "View as player" preview.
import { useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import { applyChoice, draftKey, type DraftChoice } from '../rules/draftChoice'
import { cancelChoice, saveRunState, submitChoice, type ChoiceDoc } from '../runStore'

export function useChoiceSender(
  state: RunState,
  player: RunPlayer,
  sent: ChoiceDoc | undefined,
  readOnly = false,
  dmChoosing = false,
) {
  const locked = readOnly && !dmChoosing
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const runId = state.run.id
  const waiting = Boolean(sent && !sent.error)

  async function choose(choice: DraftChoice) {
    if (locked) return
    setError(null)
    setSending(true)
    try {
      if (dmChoosing) {
        // The DM's own app: apply it now with the same rules the Run tab uses.
        await saveRunState(applyChoice(state, player.characterId, choice, Math.random), state, [])
      } else {
        await submitChoice(runId, player.characterId, choice, draftKey(player))
      }
    } catch (e) {
      if (dmChoosing && e instanceof Error) {
        setError(e.message)
        return
      }
      setError('Could not send your choice. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  async function cancel() {
    setSending(true)
    try {
      await cancelChoice(runId, player.characterId)
    } finally {
      setSending(false)
    }
  }

  return { choose, cancel, sending, waiting, error, locked }
}
