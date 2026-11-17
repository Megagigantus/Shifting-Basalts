// Pop-up on a surviving player's device when the DM opens the extraction share
// ("loot call"). Players request the items they'd like and tap Done to tell the DM.
import { useCallback, useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import { keptPercent } from '../rules/loot'
import { isFullClear } from '../rules/runFlow'
import { markLootDone, setLootRequests } from '../runStore'
import { LootCard } from '../ui/LootCard'
import { Modal } from '../ui/Modal'
import { PRIMARY_BUTTON, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

export function LootCallPopup({
  state,
  player,
  requests,
  done,
  who,
}: {
  state: RunState
  player: RunPlayer
  requests: Record<string, string[]>
  done: Record<string, boolean>
  /** The character's name, shown in the title when you play more than one. */
  who?: string
}) {
  // Closing hides it for this floor's loot call only.
  const [dismissedFloor, setDismissedFloor] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const floor = state.run.floor
  const close = useCallback(() => setDismissedFloor(floor), [floor])

  const { run } = state
  const vaultChoicePending = Boolean(run.vaultOpen && !player.vaultRelic && !player.vaultPassed)
  if (
    run.status !== 'active' ||
    !run.lootCall ||
    !run.awaitingChoice ||
    !player.alive ||
    done[player.characterId] ||
    vaultChoicePending ||
    dismissedFloor === run.floor
  ) {
    return null
  }

  const title = who ? `Choose your loot: ${who}` : 'Choose your loot'
  const items = run.loot?.items ?? []
  const myRequests = requests[player.characterId] ?? []
  const action = isFullClear(state) ? 'finishing the full clear' : 'extracting'

  async function toggleRequest(uid: string) {
    setSending(true)
    const next = myRequests.includes(uid) ? myRequests.filter((u) => u !== uid) : [...myRequests, uid]
    try {
      await setLootRequests(run.id, player.characterId, next)
    } finally {
      setSending(false)
    }
  }

  async function finish() {
    setSending(true)
    try {
      await markLootDone(run.id, player.characterId, myRequests)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={title} onClose={close} wide>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-xs text-stone-300">
          The party is {action}: it keeps {keptPercent(state)}% of the haul. Request the items you'd like, then tap Done to tell the DM.
        </p>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const requested = myRequests.includes(item.uid)
              return (
                <LootCard key={item.uid} item={item}>
                  <button
                    type="button"
                    className={cx(SMALL_BUTTON, requested && 'border-sky-500/40 bg-sky-500/20 text-sky-200')}
                    aria-pressed={requested}
                    disabled={sending}
                    onClick={() => toggleRequest(item.uid)}
                  >
                    {requested ? 'Requested (undo)' : 'Request'}
                  </button>
                </LootCard>
              )
            })}
          </div>
        ) : (
          <p className="m-0 text-xs text-stone-400">The party found no items to take home.</p>
        )}

        <div className="flex justify-end">
          <button type="button" className={PRIMARY_BUTTON} disabled={sending} onClick={finish}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
