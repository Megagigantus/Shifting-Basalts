// One-time per room clear pop-up on a player's device when a new boon draft
// opens. Remembers the last seen key in localStorage so closing or completing
// the draft won't reopen it on reload.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import type { ChoiceDoc } from '../runStore'
import { Modal } from '../ui/Modal'
import { QUIET_BUTTON } from '../ui/styles'
import { PlayerDraft } from './PlayerDraft'

const storageKeyFor = (runId: string, characterId: string) =>
  `room-cleared-seen:${runId}:${characterId}`

function readSeenKey(storageKey: string): string | null {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function writeSeenKey(storageKey: string, popupKey: string) {
  try {
    localStorage.setItem(storageKey, popupKey)
  } catch {
    // Storage blocked: the pop-up may show again on reload, which is harmless.
  }
}

export function RoomClearedPopup({ state, player, sent }: { state: RunState; player: RunPlayer; sent: ChoiceDoc | undefined }) {
  const popupKey = `${state.run.id}:${player.characterId}:${state.run.log.length}`
  const storageKey = storageKeyFor(state.run.id, player.characterId)
  const hasOffer = Boolean(player.draft || player.hiddenOffer)
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const offeredKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (player.alive && hasOffer) {
      offeredKeyRef.current = popupKey
    } else if (offeredKeyRef.current === popupKey && !hasOffer) {
      writeSeenKey(storageKey, popupKey)
      offeredKeyRef.current = null
    }
  }, [player.alive, hasOffer, popupKey, storageKey])

  const close = useCallback(() => {
    writeSeenKey(storageKey, popupKey)
    setDismissedKey(popupKey)
  }, [storageKey, popupKey])

  const seen = dismissedKey === popupKey || readSeenKey(storageKey) === popupKey
  if (!player.alive || !hasOffer || seen) return null

  const title = player.draft?.starting ? 'Choose your Starting Boon' : 'Room cleared'

  return (
    <Modal title={title} onClose={close} wide>
      <div className="flex flex-col gap-4">
        {/* Loot found section will be added here in a later task. */}

        {/* The offers carry their own "Choose a boon" heading and floor and room. */}
        <section className="flex flex-col gap-2">
          <PlayerDraft state={state} player={player} sent={sent} bare />
          <p className="m-0 text-xs text-stone-400">You can also choose from the Your draft panel on the page.</p>
        </section>

        <div className="flex justify-end">
          <button type="button" className={QUIET_BUTTON} onClick={close}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
