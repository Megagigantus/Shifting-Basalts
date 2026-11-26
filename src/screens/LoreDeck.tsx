// DM screen for browsing the lore deck, viewing cards, editing deck settings, and resetting seen cards.
import { useState } from 'react'
import { ScrollText, Settings } from 'lucide-react'
import { loreImageUrl } from '../lore/loreArt'
import { resetSeen, saveSettings } from '../lore/loreStore'
import type { LoreCard, LoreGroup, LoreState, LoreTier } from '../lore/types'
import { useLoreDeck } from '../lore/useLoreDeck'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { FIELD, FIELD_LABEL, PRIMARY_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'
import { LoreCardView, REPEAT_LABEL, SOURCE_LABEL, TIER_LABEL, TIER_TONE } from './LoreCardView'

/** DM lore deck browser: filterable card list, read-only card view modal, and settings. */
export function LoreDeck() {
  const { cards, groups, state, error } = useLoreDeck()

  const [groupFilter, setGroupFilter] = useState('')
  const [tierFilter, setTierFilter] = useState<'' | LoreTier>('')
  const [seenFilter, setSeenFilter] = useState<'' | 'seen' | 'unseen'>('')

  const [viewing, setViewing] = useState<LoreCard | null>(null)
  // Saved messages live here: the settings panel rebuilds itself after each save.
  const [notices, setNotices] = useState<Notices>({ settings: null })

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

      {/* Keyed by the saved values, so the form refills when they change elsewhere. */}
      {loaded && <DeckSettingsPanel key={JSON.stringify(state.settings)} state={state} notices={notices} onNotices={setNotices} />}

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

type Notices = { settings: string | null }

function DeckSettingsPanel({ state, notices, onNotices }: { state: LoreState; notices: Notices; onNotices: (update: (prev: Notices) => Notices) => void }) {
  const [tierLimit, setTierLimit] = useState<LoreTier>(state.settings.tierLimit)
  const [deepPerRunText, setDeepPerRunText] = useState(String(state.settings.deepPerRun))
  const [anchorName, setAnchorName] = useState(state.settings.anchor.name)
  const [anchorVoiceNote, setAnchorVoiceNote] = useState(state.settings.anchor.voiceNote)
  const [savingSettings, setSavingSettings] = useState(false)
  const settingsStatus = notices.settings
  const setSettingsStatus = (value: string | null) => onNotices((prev) => ({ ...prev, settings: value }))
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [resettingSeen, setResettingSeen] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleSaveSettings() {
    if (savingSettings) return
    const parsedDeep = Number(deepPerRunText)
    if (!Number.isInteger(parsedDeep) || parsedDeep < 0 || deepPerRunText.trim() === '') {
      setSettingsError('Deep cards per run must be a whole number 0 or higher.')
      setSettingsStatus(null)
      return
    }
    setSavingSettings(true)
    setSettingsError(null)
    setSettingsStatus(null)
    try {
      await saveSettings({
        tierLimit,
        deepPerRun: parsedDeep,
        anchor: { name: anchorName, voiceNote: anchorVoiceNote },
      })
      setSettingsStatus('Saved.')
    } catch (err) {
      setSettingsError(err instanceof Error && err.message ? err.message : 'Could not save settings.')
    } finally {
      setSavingSettings(false)
    }
  }

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
    <Panel icon={<Settings size={16} />} title="Deck settings">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={FIELD_LABEL}>
          <span>Tier limit</span>
          <select
            value={tierLimit}
            onChange={(e) => {
              setTierLimit(e.target.value as LoreTier)
              setSettingsStatus(null)
            }}
            className={cx(FIELD, 'w-full')}
          >
            <option value="open">Open</option>
            <option value="guarded">Guarded</option>
            <option value="deep">Deep</option>
          </select>
        </label>
        <label className={FIELD_LABEL}>
          <span>Deep cards per run</span>
          <input
            type="number"
            min={0}
            step={1}
            value={deepPerRunText}
            onChange={(e) => {
              setDeepPerRunText(e.target.value)
              setSettingsStatus(null)
            }}
            className={cx(FIELD, 'w-full')}
          />
        </label>
      </div>

      <label className={FIELD_LABEL}>
        <span>Anchor name</span>
        <input
          type="text"
          value={anchorName}
          onChange={(e) => {
            setAnchorName(e.target.value)
            setSettingsStatus(null)
          }}
          className={cx(FIELD, 'w-full')}
        />
      </label>

      <label className={FIELD_LABEL}>
        <span>Anchor voice note</span>
        <textarea
          rows={3}
          value={anchorVoiceNote}
          onChange={(e) => {
            setAnchorVoiceNote(e.target.value)
            setSettingsStatus(null)
          }}
          className={cx(FIELD, 'w-full')}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={handleSaveSettings} disabled={savingSettings} className={PRIMARY_BUTTON}>
          {savingSettings ? 'Saving…' : 'Save'}
        </button>
        {settingsStatus && <span className="text-xs text-emerald-300">{settingsStatus}</span>}
        {settingsError && <span className="text-xs text-rose-300">{settingsError}</span>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-800 pt-4">
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
