// DM screen for managing the lore deck: import/export, card list & editor, settings, banned terms, and seen reset.
import { useRef, useState, type ChangeEvent } from 'react'
import { Download, Plus, ScrollText, Settings, Upload } from 'lucide-react'
import { validateDeckFile } from '../lore/deckFile'
import { loreImageUrl } from '../lore/loreArt'
import {
  exportDeckJson,
  importDeck,
  resetSeen,
  saveBannedTerms,
  saveSettings,
} from '../lore/loreStore'
import type { LoreCard, LoreDeckFile, LoreGroup, LoreRepeat, LoreSource, LoreState, LoreTier } from '../lore/types'
import { useLoreDeck } from '../lore/useLoreDeck'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { FIELD, FIELD_LABEL, PRIMARY_BUTTON, QUIET_BUTTON, WELL } from '../ui/styles'
import { cx, type Tone } from '../ui/tone'
import { LoreCardEditor } from './LoreCardEditor'

const TIER_TONE: Record<LoreTier, Tone> = {
  open: 'stone',
  guarded: 'amber',
  deep: 'violet',
}

const TIER_LABEL: Record<LoreTier, string> = {
  open: 'Open',
  guarded: 'Guarded',
  deep: 'Deep',
}

const SOURCE_LABEL: Record<LoreSource, string> = {
  canon: 'Canon',
  loremaster: 'Loremaster',
  both: 'Both',
}

const REPEAT_LABEL: Record<LoreRepeat, string> = {
  once_campaign: 'Once/campaign',
  once_run: 'Once/run',
  repeatable: 'Repeatable',
}

/** DM lore deck manager: import/export, filterable card list, card modal, and settings. */
export function LoreDeck() {
  const { cards, groups, state, error } = useLoreDeck()
  const importInputRef = useRef<HTMLInputElement>(null)

  const [groupFilter, setGroupFilter] = useState('')
  const [tierFilter, setTierFilter] = useState<'' | LoreTier>('')
  const [seenFilter, setSeenFilter] = useState<'' | 'seen' | 'unseen'>('')

  const [pendingDeck, setPendingDeck] = useState<LoreDeckFile | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [editing, setEditing] = useState<'new' | LoreCard | null>(null)
  // Saved messages live here: the settings panel rebuilds itself after each save.
  const [notices, setNotices] = useState<Notices>({ settings: null, banned: null })

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

  function openImportPicker() {
    importInputRef.current?.click()
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !state) return

    setImportErrors([])
    setImportNotice(null)
    setPendingDeck(null)

    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      setImportErrors(["That file isn't valid JSON."])
      return
    }

    const result = validateDeckFile(raw, state.bannedTerms)
    if (!result.ok) {
      setImportErrors(result.errors)
      return
    }

    setPendingDeck(result.deck)
  }

  async function confirmImport() {
    if (!pendingDeck || importing) return
    setImporting(true)
    setImportErrors([])
    try {
      const result = await importDeck(pendingDeck)
      setPendingDeck(null)
      setImportNotice(`Imported ${result.cards} cards.`)
    } catch (err) {
      setImportErrors([err instanceof Error && err.message ? err.message : 'Could not import the deck.'])
    } finally {
      setImporting(false)
    }
  }

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    try {
      const json = await exportDeckJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'lore-deck.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error && err.message ? err.message : 'Could not export the deck.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <Panel
        hero
        icon={<ScrollText size={16} />}
        title="Lore deck"
        subtitle="Import, edit, and tune the DM's lore deck."
        actions={
          loaded && (
            <>
              <button type="button" onClick={openImportPicker} className={QUIET_BUTTON}>
                <Upload size={14} /> Import
              </button>
              <button type="button" onClick={handleExport} disabled={exporting} className={QUIET_BUTTON}>
                <Download size={14} /> {exporting ? 'Exporting…' : 'Export'}
              </button>
              <button type="button" onClick={() => setEditing('new')} className={PRIMARY_BUTTON}>
                <Plus size={15} /> New card
              </button>
            </>
          )
        }
      >
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleImportFile}
          className="hidden"
          aria-label="Import lore deck file"
        />

        {error && <p className="m-0 text-sm text-rose-300">{error}</p>}
        {!loaded && !error && <p className="m-0 text-sm text-stone-400">Loading…</p>}
        {exportError && <p className="m-0 text-sm text-rose-300">{exportError}</p>}

        {importNotice && (
          <p role="status" className="m-0 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
            {importNotice}
          </p>
        )}

        {importErrors.length > 0 && (
          <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            <ul className="m-0 flex max-h-60 list-disc flex-col gap-1 overflow-y-auto pl-4">
              {importErrors.map((err, i) => (
                <li key={`${i}-${err}`}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {pendingDeck && (
          <div className={cx(WELL, 'flex flex-wrap items-center justify-between gap-2 border-amber-500/40')}>
            <p className="m-0 text-xs text-stone-200">
              Import {pendingDeck.cards.length} cards in {pendingDeck.groups.length} groups? Cards with the same id are replaced; other cards stay.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPendingDeck(null)} disabled={importing} className={QUIET_BUTTON}>
                Cancel
              </button>
              <button type="button" onClick={confirmImport} disabled={importing} className={PRIMARY_BUTTON}>
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        )}

        {loaded && cards.length === 0 && (
          <div className={cx(WELL, 'flex flex-wrap items-center justify-between gap-3')}>
            <p className="m-0 text-xs text-stone-300">No lore cards yet. Import a deck file to start.</p>
            <button type="button" onClick={openImportPicker} className={PRIMARY_BUTTON}>
              <Upload size={14} /> Import
            </button>
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
                    onEdit={() => setEditing(card)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      {/* Keyed by the saved values, so the form refills when they change elsewhere. */}
      {loaded && <DeckSettingsPanel key={JSON.stringify([state.settings, state.bannedTerms])} state={state} notices={notices} onNotices={setNotices} />}

      {editing !== null && groups !== null && state !== null && (
        <LoreCardEditor
          card={editing === 'new' ? null : editing}
          groups={groups}
          seen={editing !== 'new' && Object.hasOwn(state.seen, editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function LoreCardRow({
  card,
  group,
  seen,
  onEdit,
}: {
  card: LoreCard
  group: LoreGroup | undefined
  seen: boolean
  onEdit: () => void
}) {
  const thumbUrl = loreImageUrl(card, group)
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
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

type Notices = { settings: string | null; banned: string | null }

function DeckSettingsPanel({ state, notices, onNotices }: { state: LoreState; notices: Notices; onNotices: (update: (prev: Notices) => Notices) => void }) {
  const termsInputRef = useRef<HTMLInputElement>(null)

  const [tierLimit, setTierLimit] = useState<LoreTier>(state.settings.tierLimit)
  const [deepPerRunText, setDeepPerRunText] = useState(String(state.settings.deepPerRun))
  const [anchorName, setAnchorName] = useState(state.settings.anchor.name)
  const [anchorVoiceNote, setAnchorVoiceNote] = useState(state.settings.anchor.voiceNote)
  const [savingSettings, setSavingSettings] = useState(false)
  const settingsStatus = notices.settings
  const setSettingsStatus = (value: string | null) => onNotices((prev) => ({ ...prev, settings: value }))
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [bannedText, setBannedText] = useState(state.bannedTerms.join('\n'))
  const [savingBanned, setSavingBanned] = useState(false)
  const bannedStatus = notices.banned
  const setBannedStatus = (value: string | null) => onNotices((prev) => ({ ...prev, banned: value }))
  const [bannedError, setBannedError] = useState<string | null>(null)

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

  async function handleTermsFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBannedText(await file.text())
    setBannedStatus(null)
    setBannedError(null)
  }

  async function handleSaveBanned() {
    if (savingBanned) return
    setSavingBanned(true)
    setBannedError(null)
    setBannedStatus(null)
    try {
      const count = await saveBannedTerms(bannedText)
      setBannedStatus(`${count} banned terms saved.`)
    } catch (err) {
      setBannedError(err instanceof Error && err.message ? err.message : 'Could not save banned terms.')
    } finally {
      setSavingBanned(false)
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

      <div className="flex flex-col gap-2 border-t border-stone-800 pt-4">
        <SectionLabel>Banned terms</SectionLabel>
        <p className="m-0 text-xs text-stone-400">
          Cards can't use these words anywhere except Read aloud. Kept only in the DM's private data.
        </p>
        <textarea
          rows={4}
          aria-label="Banned terms"
          value={bannedText}
          onChange={(e) => {
            setBannedText(e.target.value)
            setBannedStatus(null)
          }}
          className={cx(FIELD, 'w-full font-mono')}
        />
        <input
          ref={termsInputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleTermsFile}
          className="hidden"
          aria-label="Load banned terms from file"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => termsInputRef.current?.click()} className={QUIET_BUTTON}>
            Load from file
          </button>
          <button type="button" onClick={handleSaveBanned} disabled={savingBanned} className={PRIMARY_BUTTON}>
            {savingBanned ? 'Saving…' : 'Save'}
          </button>
          {bannedStatus && <span className="text-xs text-emerald-300">{bannedStatus}</span>}
          {bannedError && <span className="text-xs text-rose-300">{bannedError}</span>}
        </div>
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
