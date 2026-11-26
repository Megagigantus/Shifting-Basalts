// DM screen for browsing the lore deck, viewing cards, and resetting seen cards.
import { useState } from 'react'
import { RotateCcw, ScrollText } from 'lucide-react'
import { loreImageUrl } from '../lore/loreArt'
import { resetSeen } from '../lore/loreStore'
import type { LoreCard, LoreGroup, LoreTier } from '../lore/types'
import { useLoreDeck } from '../lore/useLoreDeck'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { FIELD, FIELD_LABEL, WELL } from '../ui/styles'
import { cx } from '../ui/tone'
import { LoreCardView, REPEAT_LABEL, SOURCE_LABEL, TIER_LABEL, TIER_TONE } from './LoreCardView'

/** DM lore deck browser: filterable card list, read-only card view modal, and Reset seen. */
export function LoreDeck() {
  const { cards, groups, state, error } = useLoreDeck()

  const [groupFilter, setGroupFilter] = useState('')
  const [tierFilter, setTierFilter] = useState<'' | LoreTier>('')
  const [seenFilter, setSeenFilter] = useState<'' | 'seen' | 'unseen'>('')

  const [viewing, setViewing] = useState<LoreCard | null>(null)

  const loaded = cards !== null && groups !== null && state !== null
  const groupById = new Map((groups ?? []).map((g) => [g.id, g]))

  const filteredCards = (cards ?? []).filter((card) => {
    if (groupFilter && card.group !== groupFilter) return false
    if (tierFilter && card.tier !== tierFilter) return false
    const isSeen = state ? Object.hasOwn(state.seen, card.id) : false
    if (seenFilter === 'seen' && !isSeen) return false
    if (seenFilter === 'unseen' && isSeen) return false
    return true
  })

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Panel
        hero
        icon={<ScrollText size={16} />}
        title="Lore deck"
        subtitle="Browse the lore deck. Cards are edited in src/data/lore-deck.json."
      >
        {error && <p className="m-0 text-sm text-rose-300">{error}</p>}
        {!loaded && !error && <p className="m-0 text-sm text-stone-400">Loading…</p>}

        {loaded && cards.length === 0 && (
          <div className={WELL}>
            <p className="m-0 text-xs text-stone-300">No lore cards in the deck.</p>
          </div>
        )}

        {loaded && cards.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className={FIELD_LABEL}>
                <span>Group</span>
                <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={cx(FIELD, 'w-full')}>
                  <option value="">All</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name || g.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className={FIELD_LABEL}>
                <span>Tier</span>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as '' | LoreTier)}
                  className={cx(FIELD, 'w-full')}
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="guarded">Guarded</option>
                  <option value="deep">Deep</option>
                </select>
              </label>
              <label className={FIELD_LABEL}>
                <span>Seen</span>
                <select
                  value={seenFilter}
                  onChange={(e) => setSeenFilter(e.target.value as '' | 'seen' | 'unseen')}
                  className={cx(FIELD, 'w-full')}
                >
                  <option value="">All</option>
                  <option value="seen">Seen</option>
                  <option value="unseen">Unseen</option>
                </select>
              </label>
            </div>

            <p className="m-0 text-xs text-stone-400">
              {filteredCards.length} of {cards.length} cards
            </p>

            {filteredCards.length === 0 ? (
              <p className="m-0 text-xs text-stone-500">No cards match those filters.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {filteredCards.map((card) => (
                  <LoreCardRow
                    key={card.id}
                    card={card}
                    group={groupById.get(card.group)}
                    seen={Object.hasOwn(state.seen, card.id)}
                    onOpen={() => setViewing(card)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      {loaded && <ResetSeenPanel />}

      {viewing !== null && (
        <LoreCardView
          card={viewing}
          group={groupById.get(viewing.group)}
          seen={state !== null && Object.hasOwn(state.seen, viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

function LoreCardRow({
  card,
  group,
  seen,
  onOpen,
}: {
  card: LoreCard
  group: LoreGroup | undefined
  seen: boolean
  onOpen: () => void
}) {
  const thumbUrl = loreImageUrl(card, group)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-stone-800 bg-stone-950/60 p-2.5 text-left transition-colors hover:border-stone-700 hover:bg-stone-900/80"
      >
        <div className="aspect-video w-20 shrink-0 overflow-hidden rounded-md border border-stone-800 bg-stone-950 sm:w-24">
          {thumbUrl && <img src={thumbUrl} alt="" className="block h-full w-full object-cover" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong className="text-sm text-stone-100">{card.title}</strong>
            <Pill tone={TIER_TONE[card.tier]}>{TIER_LABEL[card.tier]}</Pill>
            {seen && <Pill tone="emerald">Seen</Pill>}
            {card.adHoc === true && <Pill tone="sky">Written in play</Pill>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400">
            <span>{group?.name || card.group}</span>
            <span aria-hidden="true">·</span>
            <span>{SOURCE_LABEL[card.source]}</span>
            <span aria-hidden="true">·</span>
            <span>{REPEAT_LABEL[card.repeat]}</span>
            <span aria-hidden="true">·</span>
            <span className="text-stone-300">{card.trigger.label}</span>
          </div>
        </div>
      </button>
    </li>
  )
}

/** Reset seen: lets every card fire again. Other deck settings live in src/data/lore-deck.json. */
function ResetSeenPanel() {
  const [resettingSeen, setResettingSeen] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleResetSeen() {
    if (resettingSeen) return
    setResettingSeen(true)
    setResetError(null)
    try {
      await resetSeen()
    } catch (err) {
      setResetError(err instanceof Error && err.message ? err.message : 'Could not reset seen cards.')
    } finally {
      setResettingSeen(false)
    }
  }

  return (
    <Panel icon={<RotateCcw size={16} />} title="Reset seen">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-stone-400">Lets every card fire again.</span>
        <div className="flex items-center gap-2">
          {resetError && <span className="text-xs text-rose-300">{resetError}</span>}
          <ConfirmButton confirmLabel="Yes, reset" disabled={resettingSeen} onConfirm={handleResetSeen}>
            Reset seen
          </ConfirmButton>
        </div>
      </div>
    </Panel>
  )
}
