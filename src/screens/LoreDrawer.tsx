// DM-only floating drawer for the next queued lore card and its reveal controls.
import { useState } from 'react'
import { ChevronDown, ChevronUp, ScrollText } from 'lucide-react'
import { loreImageUrl } from '../lore/loreArt'
import { fillPlaceholders, missingFills, type LoreQueueItem, type RevealTarget } from '../lore/reveal'
import { advanceReveal, dismissItem, finishReveal, skipItem, startReveal } from '../lore/revealStore'
import type { LoreCard, LoreGroup, LoreSource, LoreTier } from '../lore/types'
import { useLoreDeck } from '../lore/useLoreDeck'
import { useLoreQueue } from '../lore/useLoreReveal'
import type { RunPlayer, RunState } from '../model/run'
import { useCharacters } from '../useCharacters'
import { ConfirmButton } from '../ui/ConfirmButton'
import { SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { FIELD, FIELD_LABEL, PRIMARY_BUTTON, QUIET_BUTTON, WELL } from '../ui/styles'
import { cx, type Tone } from '../ui/tone'

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

const STAGE_LABEL: Record<'image' | 'text' | 'more', string> = {
  image: 'Image',
  text: 'Text',
  more: 'More',
}

/** Floating bottom-right drawer showing the DM's current queued lore card and reveal controls. */
export function LoreDrawer({ state }: { state: RunState | null }) {
  const runId = state?.run.id ?? null
  const { current, waiting } = useLoreQueue(runId)
  const { cards, groups, error: deckError } = useLoreDeck()
  const { characters } = useCharacters()

  if (!state || !current) return null

  return (
    <LoreDrawerCard
      key={current.id}
      runId={state.run.id}
      players={state.players}
      item={current}
      waiting={waiting}
      cards={cards}
      groups={groups}
      deckError={deckError}
      characters={characters}
    />
  )
}

interface CardProps {
  runId: string
  players: RunPlayer[]
  item: LoreQueueItem
  waiting: number
  cards: LoreCard[] | null
  groups: LoreGroup[] | null
  deckError: string | null
  characters: { id: string; playerEmail: string }[] | null
}

function LoreDrawerCard({ runId, players, item, waiting, cards, groups, deckError, characters }: CardProps) {
  const [expanded, setExpanded] = useState(true)
  const [fills, setFills] = useState<Record<string, string>>({})
  const [pickingAudience, setPickingAudience] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const card = cards?.find((entry) => entry.id === item.cardId) ?? null
  const group = card && groups ? groups.find((entry) => entry.id === card.group) : undefined
  const imageUrl = card ? loreImageUrl(card, group) : null

  const emailByCharId = new Map((characters ?? []).map((c) => [c.id, c.playerEmail]))
  const playerNameById = new Map(players.map((p) => [p.characterId, p.name]))

  function toTarget(player: RunPlayer): RevealTarget {
    return {
      characterId: player.characterId,
      playerEmail: emailByCharId.get(player.characterId) ?? '',
    }
  }

  function toggleSelected(characterId: string) {
    setSelectedIds((prev) =>
      prev.includes(characterId) ? prev.filter((id) => id !== characterId) : [...prev, characterId],
    )
  }

  async function runAction(fn: () => Promise<unknown>, fallbackMessage: string) {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err instanceof Error && err.message ? err.message : fallbackMessage)
    } finally {
      setBusy(false)
    }
  }

  function handleRevealAll() {
    if (!card) return
    void runAction(
      () =>
        startReveal({
          runId,
          item,
          card,
          imageUrl,
          targets: players.map(toTarget),
          everyone: true,
          fills,
        }),
      'Could not start the reveal.',
    )
  }

  function handleRevealSelected() {
    if (!card || selectedIds.length === 0) return
    const targets = players.filter((p) => selectedIds.includes(p.characterId)).map(toTarget)
    void runAction(
      async () => {
        await startReveal({
          runId,
          item,
          card,
          imageUrl,
          targets,
          everyone: false,
          fills,
        })
        setPickingAudience(false)
      },
      'Could not start the reveal.',
    )
  }

  function handleSkip() {
    void runAction(() => skipItem(runId, item.id), 'Could not skip this card.')
  }

  function handleDismiss() {
    void runAction(() => dismissItem(runId, item), 'Could not dismiss this card.')
  }

  function handleAdvance(stage: 'text' | 'more') {
    if (!card) return
    void runAction(() => advanceReveal({ runId, item, card, imageUrl, stage }), 'Could not advance the reveal.')
  }

  function handleDone() {
    if (!card) return
    void runAction(() => finishReveal({ runId, item, card, imageUrl }), 'Could not finish the reveal.')
  }

  const headerTitle = card ? card.title : cards === null && !deckError ? 'Loading…' : item.cardId || 'Missing card'

  return (
    <aside
      aria-label="Lore prompt"
      className="fixed inset-x-2 bottom-4 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-stone-700 bg-stone-900/95 text-stone-100 shadow-2xl shadow-black/60 backdrop-blur sm:inset-x-auto sm:right-4 sm:w-[26rem]"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full shrink-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5 py-2.5 text-left transition-colors hover:bg-stone-800/60"
      >
        <ScrollText size={15} className="shrink-0 text-amber-300" aria-hidden="true" />
        <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-amber-300">Lore</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-100">{headerTitle}</span>
        {waiting > 0 && <Pill tone="stone">{waiting} more waiting</Pill>}
        {expanded ? (
          <ChevronDown size={16} className="shrink-0 text-stone-400" aria-hidden="true" />
        ) : (
          <ChevronUp size={16} className="shrink-0 text-stone-400" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto border-t border-stone-800 p-3.5">
          {cards === null && !deckError && <p className="m-0 text-sm text-stone-400">Loading…</p>}

          {deckError && (
            <p role="alert" className="m-0 text-sm text-rose-300">
              {deckError}
            </p>
          )}

          {cards !== null && !card && (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-sm text-stone-300">This card is no longer in the deck.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={handleSkip} className={QUIET_BUTTON}>
                  Skip
                </button>
              </div>
              {actionError && (
                <p role="alert" className="m-0 text-xs text-rose-300">
                  {actionError}
                </p>
              )}
            </div>
          )}

          {card && (
            <LoreDrawerBody
              card={card}
              imageUrl={imageUrl}
              item={item}
              players={players}
              playerNameById={playerNameById}
              fills={fills}
              onFillChange={(name, value) => setFills((prev) => ({ ...prev, [name]: value }))}
              pickingAudience={pickingAudience}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelected}
              onOpenPicker={() => {
                setSelectedIds([])
                setPickingAudience(true)
              }}
              onCancelPicker={() => {
                setPickingAudience(false)
                setSelectedIds([])
              }}
              busy={busy}
              actionError={actionError}
              onRevealAll={handleRevealAll}
              onRevealSelected={handleRevealSelected}
              onSkip={handleSkip}
              onDismiss={handleDismiss}
              onAdvance={handleAdvance}
              onDone={handleDone}
            />
          )}
        </div>
      )}
    </aside>
  )
}

interface BodyProps {
  card: LoreCard
  imageUrl: string | null
  item: LoreQueueItem
  players: RunPlayer[]
  playerNameById: Map<string, string>
  fills: Record<string, string>
  onFillChange: (name: string, value: string) => void
  pickingAudience: boolean
  selectedIds: string[]
  onToggleSelected: (id: string) => void
  onOpenPicker: () => void
  onCancelPicker: () => void
  busy: boolean
  actionError: string | null
  onRevealAll: () => void
  onRevealSelected: () => void
  onSkip: () => void
  onDismiss: () => void
  onAdvance: (stage: 'text' | 'more') => void
  onDone: () => void
}

function uniquePlaceholders(names: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
}

function LoreDrawerBody({
  card,
  imageUrl,
  item,
  players,
  playerNameById,
  fills,
  onFillChange,
  pickingAudience,
  selectedIds,
  onToggleSelected,
  onOpenPicker,
  onCancelPicker,
  busy,
  actionError,
  onRevealAll,
  onRevealSelected,
  onSkip,
  onDismiss,
  onAdvance,
  onDone,
}: BodyProps) {
  const isLive = item.status === 'live'
  const savedFills = item.fills ?? {}
  const activeFills = isLive ? savedFills : fills
  const placeholders = uniquePlaceholders(card.placeholders)
  const missing = isLive ? [] : missingFills(card, fills)
  const stage = item.stage ?? 'image'
  const hasPush = card.push.trim().length > 0
  const audienceNames = (item.audience ?? []).map((id) => playerNameById.get(id) ?? id).join(', ')

  return (
    <>
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-stone-800 bg-stone-950">
        {imageUrl && <img src={imageUrl} alt="" className="block h-full w-full object-cover" />}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={TIER_TONE[card.tier]}>{TIER_LABEL[card.tier]}</Pill>
        <Pill tone="stone">{SOURCE_LABEL[card.source]}</Pill>
        {card.trigger.label && <span className="text-xs text-stone-400">{card.trigger.label}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel>Read aloud</SectionLabel>
        <p className="m-0 whitespace-pre-wrap text-lg leading-snug text-stone-100">
          {fillPlaceholders(card.readAloud, activeFills)}
        </p>
      </div>

      {placeholders.length > 0 && !isLive && (
        <div className="flex flex-col gap-2">
          {placeholders.map((name) => (
            <label key={name} className={FIELD_LABEL}>
              <span>{name}</span>
              <input
                type="text"
                value={fills[name] ?? ''}
                disabled={busy}
                onChange={(e) => onFillChange(name, e.target.value)}
                className={cx(FIELD, 'w-full')}
              />
            </label>
          ))}
        </div>
      )}

      {placeholders.length > 0 && isLive && (
        <div className="flex flex-wrap gap-1.5">
          {placeholders.map((name) => (
            <span
              key={name}
              className="rounded-md border border-stone-800 bg-stone-950/70 px-2 py-1 text-xs text-stone-300"
            >
              <span className="text-stone-400">{name}:</span> {savedFills[name]?.trim() || '—'}
            </span>
          ))}
        </div>
      )}

      {hasPush && (
        <div className="flex flex-col gap-0.5">
          <SectionLabel>If they push</SectionLabel>
          <p className="m-0 whitespace-pre-wrap text-xs text-stone-400">{card.push}</p>
        </div>
      )}

      {card.dmTruth.trim() && (
        <div className="flex flex-col gap-1 rounded-lg border border-rose-500/50 bg-rose-950/20 p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-rose-400">DM only</span>
            <span className="text-[0.6875rem] font-semibold text-rose-200/80">DM truth</span>
          </div>
          <p className="m-0 whitespace-pre-wrap text-xs text-rose-100">{card.dmTruth}</p>
        </div>
      )}

      {!isLive && missing.length > 0 && (
        <p className="m-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
          Fill in: {missing.join(', ')}
        </p>
      )}

      {!isLive && (
        <div className="flex flex-col gap-2 border-t border-stone-800 pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={onRevealAll} className={PRIMARY_BUTTON}>
              Reveal to all
            </button>
            <button type="button" disabled={busy} onClick={onOpenPicker} className={QUIET_BUTTON}>
              Reveal to...
            </button>
            <button type="button" disabled={busy} onClick={onSkip} className={QUIET_BUTTON}>
              Skip
            </button>
            <ConfirmButton confirmLabel="Mark seen" disabled={busy} onConfirm={onDismiss}>
              Dismiss
            </ConfirmButton>
          </div>

          {pickingAudience && (
            <div className={cx(WELL, 'flex flex-col gap-2')}>
              <SectionLabel>Reveal to</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {players.map((player) => (
                  <label
                    key={player.characterId}
                    className="flex cursor-pointer items-center gap-2 text-xs text-stone-200"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(player.characterId)}
                      disabled={busy}
                      onChange={() => onToggleSelected(player.characterId)}
                      className="h-3.5 w-3.5 accent-amber-500"
                    />
                    <span>{player.name}</span>
                    {!player.alive && <span className="text-[0.6875rem] text-stone-500">(fallen)</span>}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy || selectedIds.length === 0}
                  onClick={onRevealSelected}
                  className={PRIMARY_BUTTON}
                >
                  Reveal
                </button>
                <button type="button" disabled={busy} onClick={onCancelPicker} className={QUIET_BUTTON}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isLive && (
        <div className="flex flex-col gap-2 border-t border-stone-800 pt-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-stone-300">
              {item.everyone ? 'Showing to everyone' : `Showing to: ${audienceNames || 'none'}`}
            </span>
            <Pill tone="amber">Stage: {STAGE_LABEL[stage]}</Pill>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || stage !== 'image'}
              onClick={() => onAdvance('text')}
              className={cx(QUIET_BUTTON, 'disabled:cursor-default disabled:opacity-40')}
            >
              Show text
            </button>
            <button
              type="button"
              disabled={busy || stage !== 'text' || !hasPush}
              onClick={() => onAdvance('more')}
              className={cx(QUIET_BUTTON, 'disabled:cursor-default disabled:opacity-40')}
            >
              Show more
            </button>
            <button type="button" disabled={busy} onClick={onDone} className={PRIMARY_BUTTON}>
              Done
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p role="alert" className="m-0 text-xs text-rose-300">
          {actionError}
        </p>
      )}
    </>
  )
}
