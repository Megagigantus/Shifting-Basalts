// A player's own draft on their device: they choose, the choice is sent to
// the DM's app (which applies it), and they see whether it went through. In
// the DM's "View as player" preview, the DM's pick is applied straight away.
import { useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import { applyChoice, draftKey, type DraftChoice } from '../rules/draftChoice'
import { rerollsLeft } from '../rules/draftFlow'
import { passQuantumBasalts } from '../rules/run'
import { cancelChoice, saveRunState, submitChoice, type ChoiceDoc } from '../runStore'
import { DraftOffers } from './DraftOffers'
import { ForgePanel } from './ForgePanel'
import { forgeUsesLeft } from '../rules/forge'
import { Hourglass } from 'lucide-react'
import { Panel } from '../ui/Panel'
import { LINK_BUTTON } from '../ui/styles'

interface Props {
  state: RunState
  player: RunPlayer
  sent: ChoiceDoc | undefined
  /** The DM's read-only preview: show the offer, but don't send anything. */
  readOnly?: boolean
  /** In the DM's preview: the DM picks for this player (the DM's app applies it like a player's choice). */
  dmChoosing?: boolean
}

const ACTION_LABELS: Record<ChoiceDoc['action'], string> = {
  take: 'your pick',
  pass: 'a pass',
  reroll: 'a reroll',
  hidden: 'your hidden boon pick',
  passHidden: 'a pass on the hidden offer',
  forge: 'your Forge use',
  hiddenSight: 'your Hidden Sight request',
  relic: 'your relic pick',
  relicPass: 'your Vault pass',
  recover: 'your slot recovery',
  surge: 'your Leyline Surge',
  reprieveRest: 'your Reprieve choice (Rest)',
  reprieveReflect: 'your Reprieve choice (Reflect)',
  reprieveBasalts: 'your Reprieve choice (catch-up Basalts)',
}

export function PlayerDraft({ state, player, sent, readOnly = false, dmChoosing = false }: Props) {
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

  const forgeUses = forgeUsesLeft(state)
  if (!player.alive || (!player.draft && !player.hiddenOffer && forgeUses < 1)) return null

  return (
    <Panel tone="violet" title={player.draft || player.hiddenOffer ? 'Your draft' : 'The Forge'}>
      {waiting && (
        <p className="m-0 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Hourglass size={14} />
          <span className="mr-auto">Sent {ACTION_LABELS[sent!.action]}. Waiting for your DM's app to apply it…</span>
          {!locked && (
            <button type="button" className={LINK_BUTTON} disabled={sending} onClick={cancel}>
              Change my mind
            </button>
          )}
        </p>
      )}
      {sent?.error && <p className="m-0 text-xs text-rose-300">Your last choice didn't go through: {sent.error}</p>}
      {locked && <p className="m-0 text-[0.6875rem] text-stone-500">Preview: choices are disabled here.</p>}
      {readOnly && dmChoosing && (
        <p className="m-0 text-[0.6875rem] text-sky-300">DM preview: you're choosing for {player.name}. It goes through just like their own pick.</p>
      )}
      <DraftOffers
        player={player}
        passValue={passQuantumBasalts(state.run.entryMultiplier)}
        rerollsLeft={rerollsLeft(player, state.run.floor)}
        busy={locked || sending || waiting}
        onChoose={choose}
      />
      <ForgePanel
        players={[player]}
        usesLeft={forgeUses}
        busy={locked || sending || waiting}
        intro="The Forge is shared by the party, so agree on who uses it."
        onUse={(_, forge) => choose({ action: 'forge', forge })}
      />
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </Panel>
  )
}
