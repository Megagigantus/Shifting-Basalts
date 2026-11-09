// A player's own draft on their device: they choose, the choice is sent to
// the DM's app (which applies it), and they see whether it went through.
import { useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import { draftKey, type DraftChoice } from '../rules/draftChoice'
import { rerollsLeft } from '../rules/draftFlow'
import { passQuantumBasalts } from '../rules/run'
import { cancelChoice, submitChoice, type ChoiceDoc } from '../runStore'
import { DraftOffers } from './DraftOffers'

interface Props {
  state: RunState
  player: RunPlayer
  sent: ChoiceDoc | undefined
  /** The DM's read-only preview: show the offer, but don't send anything. */
  readOnly?: boolean
}

const ACTION_LABELS: Record<ChoiceDoc['action'], string> = {
  take: 'your pick',
  pass: 'a pass',
  reroll: 'a reroll',
  hidden: 'your hidden boon pick',
  passHidden: 'a pass on the hidden offer',
}

export function PlayerDraft({ state, player, sent, readOnly = false }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const runId = state.run.id
  const waiting = Boolean(sent && !sent.error)

  async function choose(choice: DraftChoice) {
    if (readOnly) return
    setError(null)
    setSending(true)
    try {
      await submitChoice(runId, player.characterId, choice, draftKey(player))
    } catch {
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

  if (!player.alive || (!player.draft && !player.hiddenOffer)) return null

  return (
    <div className="player-draft">
      {waiting && (
        <p className="waiting-banner">
          Sent {ACTION_LABELS[sent!.action]}. Waiting for your DM's app to apply it…{' '}
          {!readOnly && (
            <button type="button" className="link" disabled={sending} onClick={cancel}>
              Change my mind
            </button>
          )}
        </p>
      )}
      {sent?.error && <p className="error">Your last choice didn't go through: {sent.error}</p>}
      {readOnly && <p className="hint">Preview: choices are disabled here.</p>}
      <DraftOffers
        player={player}
        passValue={passQuantumBasalts(state.run.entryMultiplier)}
        rerollsLeft={rerollsLeft(player, state.run.floor)}
        busy={readOnly || sending || waiting}
        onChoose={choose}
      />
      {error && <p className="error">{error}</p>}
    </div>
  )
}
