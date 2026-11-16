// One-time per room clear pop-up on a player's device when a new boon draft
// or room loot appears. Remembers the last seen key in localStorage so closing
// or completing a loot-free draft won't reopen it on reload.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Coins, Hexagon, Package } from 'lucide-react'
import { currencyArt } from '../boonLootArt'
import type { RunPlayer, RunState } from '../model/run'
import { roomDrops } from '../rules/loot'
import { setLootRequests, type ChoiceDoc } from '../runStore'
import { LootCard } from '../ui/LootCard'
import { Modal } from '../ui/Modal'
import { SectionLabel } from '../ui/Panel'
import { QUIET_BUTTON, SMALL_BUTTON } from '../ui/styles'
import { cx, toneClasses } from '../ui/tone'
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

function CurrencyTile({
  art,
  icon,
  tone,
  value,
  caption,
}: {
  art: string | null
  icon: ReactNode
  tone: 'amber' | 'purple'
  value: string
  caption: string
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return (
    <div className={cx('flex items-center gap-2.5 rounded-xl border bg-stone-950/70 px-3 py-2', toneClasses[tone].border)}>
      {art && failedUrl !== art ? (
        <img
          src={art}
          alt=""
          loading="lazy"
          onError={() => setFailedUrl(art)}
          className="h-8 w-8 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-stone-900', toneClasses[tone].text)}
        >
          {icon}
        </span>
      )}
      <div className="flex flex-col">
        <strong className={cx('font-mono text-sm leading-tight', toneClasses[tone].text)}>{value}</strong>
        <span className="text-[0.6875rem] text-stone-400">{caption}</span>
      </div>
    </div>
  )
}

export function RoomClearedPopup({
  state,
  player,
  sent,
  requests,
  who,
}: {
  state: RunState
  player: RunPlayer
  sent: ChoiceDoc | undefined
  requests: Record<string, string[]>
  /** The character's name, shown in the title when you play more than one. */
  who?: string
}) {
  const popupKey = `${state.run.id}:${player.characterId}:${state.run.log.length}`
  const storageKey = storageKeyFor(state.run.id, player.characterId)
  const hasOffer = Boolean(player.draft || player.hiddenOffer)
  const drops = roomDrops(state)
  const hasLoot = drops.items.length > 0 || drops.credits > 0 || drops.basalts > 0
  const [dismissedKey, setDismissedKey] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const offeredKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (player.alive && hasOffer) {
      offeredKeyRef.current = popupKey
    } else if (offeredKeyRef.current === popupKey && !hasOffer && !hasLoot) {
      writeSeenKey(storageKey, popupKey)
      offeredKeyRef.current = null
    }
  }, [player.alive, hasOffer, hasLoot, popupKey, storageKey])

  const close = useCallback(() => {
    writeSeenKey(storageKey, popupKey)
    setDismissedKey(popupKey)
  }, [storageKey, popupKey])

  const seen = dismissedKey === popupKey || readSeenKey(storageKey) === popupKey
  if (!player.alive || (!hasOffer && !hasLoot) || seen) return null

  const base = player.draft?.starting ? 'Choose your Starting Boon' : 'Room cleared'
  const title = who ? `${base}: ${who}` : base
  const myRequests = requests[player.characterId] ?? []

  async function toggleRequest(uid: string) {
    setSending(true)
    const next = myRequests.includes(uid) ? myRequests.filter((u) => u !== uid) : [...myRequests, uid]
    try {
      await setLootRequests(state.run.id, player.characterId, next)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal title={title} onClose={close} wide>
      <div className="flex flex-col gap-4">
        {hasLoot && (
          <section className="flex flex-col gap-2.5">
            <SectionLabel className="flex items-center gap-1.5">
              <Package size={12} /> Loot found
            </SectionLabel>
            {(drops.credits > 0 || drops.basalts > 0) && (
              <div className="flex flex-wrap gap-2">
                {drops.credits > 0 && (
                  <CurrencyTile
                    art={currencyArt('credits')}
                    icon={<Coins size={18} />}
                    tone="amber"
                    value={`+${drops.credits.toLocaleString()} cr`}
                    caption="Party credits"
                  />
                )}
                {drops.basalts > 0 && (
                  <CurrencyTile
                    art={currencyArt('quantum-basalts')}
                    icon={<Hexagon size={18} />}
                    tone="purple"
                    value={`+${drops.basalts.toLocaleString()}`}
                    caption="Quantum Basalts each"
                  />
                )}
              </div>
            )}
            {drops.items.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {drops.items.map((item) => {
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
            )}
            <p className="m-0 text-[0.6875rem] text-stone-400">
              Loot goes to the party pool. Requests tell the DM what you'd like; the party decides at extraction.
            </p>
          </section>
        )}

        {/* The offers carry their own "Choose a boon" heading and floor and room. */}
        {hasOffer && (
          <section className="flex flex-col gap-2">
            <PlayerDraft state={state} player={player} sent={sent} bare />
            <p className="m-0 text-xs text-stone-400">You can also choose from the Your draft panel on the page.</p>
          </section>
        )}

        <div className="flex justify-end">
          <button type="button" className={QUIET_BUTTON} onClick={close}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
