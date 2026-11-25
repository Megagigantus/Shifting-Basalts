// DM-only panel for Caretaker-9 dispatches: send one question per post-boss room,
// and answer due questions with a deck card or a newly written ad-hoc card.
import { useState } from 'react'
import { RadioTower } from 'lucide-react'
import { answerDispatch, askDispatch, useDispatches, writeAndAnswer } from '../lore/dispatchStore'
import { askedThisRoom, dueDispatches, type LoreDispatch } from '../lore/dispatches'
import { loreImageUrl } from '../lore/loreArt'
import type { LoreCard, LoreGroup, LoreTier } from '../lore/types'
import { useLoreDeck } from '../lore/useLoreDeck'
import type { Character } from '../model/character'
import type { RunState } from '../model/run'
import { Panel, SectionLabel } from '../ui/Panel'
import { FIELD, FIELD_LABEL, PRIMARY_BUTTON, WELL } from '../ui/styles'
import { cx, toneClasses } from '../ui/tone'

const TIER_LABEL: Record<LoreTier, string> = {
  open: 'Open',
  guarded: 'Guarded',
  deep: 'Deep',
}

const TAB_BUTTON =
  'inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50'

interface AnsweredReceipt {
  id: string
  runId: string
  question: string
  floor: number
  message: string
}

interface DispatchPanelProps {
  state: RunState
  characters: Character[]
  runEnded: boolean
}

export function DispatchPanel({ state, characters, runEnded }: DispatchPanelProps) {
  const { run } = state
  const { cards, groups, state: loreState, error: deckError } = useLoreDeck()
  const dispatches = useDispatches(run.id)

  const [question, setQuestion] = useState('')
  const [askError, setAskError] = useState<string | null>(null)
  const [askBusy, setAskBusy] = useState(false)
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [answered, setAnswered] = useState<Record<string, AnsweredReceipt>>({})

  const canAsk = !runEnded && run.awaitingChoice
  const sentThisRoom = canAsk ? askedThisRoom(dispatches, run.id, run.floor) : null
  const due = dueDispatches(dispatches, run.id, run.floor, runEnded).filter((d) => !answered[d.id])
  const receipts = Object.values(answered).filter((r) => r.runId === run.id)

  if (!canAsk && due.length === 0 && receipts.length === 0) {
    return null
  }

  const anchor = loreState?.settings.anchor.name.trim() || 'your Stride Anchor'
  const voiceNote = loreState?.settings.anchor.voiceNote.trim() || ''

  const partyIds = new Set(run.characterIds)
  const emails = Array.from(
    new Set(
      characters
        .filter((c) => partyIds.has(c.id))
        .map((c) => (c.playerEmail ?? '').trim().toLowerCase())
        .filter(Boolean),
    ),
  )

  const dispatchCards = cards ? cards.filter((c) => c.group === 'dispatch') : null
  const working = askBusy || answeringId !== null

  async function handleAsk() {
    if (working) return
    setAskError(null)
    setAskBusy(true)
    try {
      await askDispatch(run.id, run.floor, question)
      setQuestion('')
    } catch (err) {
      setAskError(err instanceof Error && err.message ? err.message : 'Could not send the question.')
    } finally {
      setAskBusy(false)
    }
  }

  function markAnswered(dispatch: LoreDispatch) {
    const message = runEnded
      ? "Filed in the party's Libraries. Read it aloud."
      : 'Queued in your lore drawer.'
    setAnswered((prev) => ({
      ...prev,
      [dispatch.id]: {
        id: dispatch.id,
        runId: run.id,
        question: dispatch.question,
        floor: dispatch.floor,
        message,
      },
    }))
  }

  return (
    <Panel
      tone="sky"
      title={`${anchor} dispatches`}
      subtitle={voiceNote || undefined}
      icon={<RadioTower size={16} />}
    >
      {canAsk && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Ask</SectionLabel>
          {sentThisRoom ? (
            <div className={cx(WELL, 'box-border text-xs text-stone-300')}>
              <span className="text-stone-400">Sent:</span> {sentThisRoom.question}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleAsk()
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                value={question}
                disabled={working}
                placeholder="The party's question"
                aria-label="The party's question"
                onChange={(e) => setQuestion(e.target.value)}
                className={cx(FIELD, 'min-w-0 flex-1')}
              />
              <button
                type="submit"
                disabled={working}
                className={cx(
                  'inline-flex items-center justify-center gap-1.5 rounded-lg border-0 px-3.5 py-2 text-xs font-bold cursor-pointer disabled:opacity-60',
                  toneClasses.sky.button,
                )}
              >
                Send to {anchor}
              </button>
            </form>
          )}
          {askError && (
            <p role="alert" className="m-0 text-xs text-rose-300">
              {askError}
            </p>
          )}
        </div>
      )}

      {(due.length > 0 || receipts.length > 0) && (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Due answers</SectionLabel>
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="box-border flex flex-col gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3"
            >
              <p className="m-0 text-sm font-semibold text-stone-100">“{receipt.question}”</p>
              <p className="m-0 text-xs text-stone-400">Asked after the floor {receipt.floor} boss</p>
              <p className="m-0 text-xs font-semibold text-emerald-200">{receipt.message}</p>
            </div>
          ))}
          {due.map((dispatch) => (
            <DueDispatchCard
              key={dispatch.id}
              dispatch={dispatch}
              runId={run.id}
              runEnded={runEnded}
              emails={emails}
              cards={dispatchCards}
              groups={groups}
              deckError={deckError}
              busy={working}
              onStart={() => setAnsweringId(dispatch.id)}
              onFinish={() => setAnsweringId(null)}
              onAnswered={() => markAnswered(dispatch)}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

interface DueDispatchCardProps {
  dispatch: LoreDispatch
  runId: string
  runEnded: boolean
  emails: string[]
  cards: LoreCard[] | null
  groups: LoreGroup[] | null
  deckError: string | null
  busy: boolean
  onStart: () => void
  onFinish: () => void
  onAnswered: () => void
}

function DueDispatchCard({
  dispatch,
  runId,
  runEnded,
  emails,
  cards,
  groups,
  deckError,
  busy,
  onStart,
  onFinish,
  onAnswered,
}: DueDispatchCardProps) {
  const [mode, setMode] = useState<'card' | 'write'>('card')
  const [selectedCardId, setSelectedCardId] = useState('')
  const [title, setTitle] = useState('')
  const [readAloud, setReadAloud] = useState('')
  const [push, setPush] = useState('')
  const [dmTruth, setDmTruth] = useState('')
  const [tier, setTier] = useState<LoreTier>('guarded')
  const [errors, setErrors] = useState<string[]>([])

  const effectiveCardId = cards && cards.some((c) => c.id === selectedCardId) ? selectedCardId : (cards?.[0]?.id ?? '')
  const selectedCard = cards?.find((c) => c.id === effectiveCardId) ?? null

  const tabClass = (active: boolean) =>
    cx(
      TAB_BUTTON,
      active
        ? 'border-sky-500/40 bg-sky-500/20 text-sky-200'
        : 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800',
    )

  async function handleAnswerCard() {
    if (busy || !selectedCard) return
    setErrors([])
    onStart()
    try {
      const group = groups?.find((g) => g.id === selectedCard.group)
      await answerDispatch({
        dispatch,
        card: selectedCard,
        runActive: !runEnded,
        runId,
        emails,
        imageUrl: loreImageUrl(selectedCard, group),
      })
      onAnswered()
    } catch (err) {
      setErrors([err instanceof Error && err.message ? err.message : 'Could not answer this dispatch.'])
    } finally {
      onFinish()
    }
  }

  async function handleWriteAndAnswer() {
    if (busy) return
    setErrors([])
    onStart()
    try {
      const validationErrors = await writeAndAnswer({
        dispatch,
        fields: { title, readAloud, push, dmTruth, tier },
        runActive: !runEnded,
        runId,
        emails,
      })
      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        return
      }
      onAnswered()
    } catch (err) {
      setErrors([err instanceof Error && err.message ? err.message : 'Could not save and answer this dispatch.'])
    } finally {
      onFinish()
    }
  }

  return (
    <div className="box-border flex flex-col gap-2.5 rounded-xl border border-stone-800 bg-stone-950/70 p-3">
      <div className="flex flex-col gap-0.5">
        <p className="m-0 text-sm font-semibold text-stone-100">“{dispatch.question}”</p>
        <p className="m-0 text-xs text-stone-400">Asked after the floor {dispatch.floor} boss</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Answer method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'card'}
          disabled={busy}
          onClick={() => {
            setMode('card')
            setErrors([])
          }}
          className={tabClass(mode === 'card')}
        >
          Answer with a card
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'write'}
          disabled={busy}
          onClick={() => {
            setMode('write')
            setErrors([])
          }}
          className={tabClass(mode === 'write')}
        >
          Write an answer
        </button>
      </div>

      {mode === 'card' ? (
        <div className="flex flex-col gap-2">
          {cards === null && !deckError && <p className="m-0 text-xs text-stone-400">Loading deck…</p>}
          {deckError && (
            <p role="alert" className="m-0 text-xs text-rose-300">
              {deckError}
            </p>
          )}
          {cards !== null && cards.length === 0 && (
            <p className="m-0 text-xs text-stone-400">
              No dispatch cards in the deck yet. Use &ldquo;Write an answer&rdquo; instead.
            </p>
          )}
          {cards !== null && cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Dispatch card"
                value={effectiveCardId}
                disabled={busy}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className={cx(FIELD, 'min-w-0 flex-1 text-xs')}
              >
                {cards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.title} ({TIER_LABEL[card.tier]})
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !selectedCard}
                onClick={() => void handleAnswerCard()}
                className={PRIMARY_BUTTON}
              >
                Answer
              </button>
            </div>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleWriteAndAnswer()
          }}
          className="flex flex-col gap-2.5"
        >
          <label className={FIELD_LABEL}>
            <span>Title</span>
            <input
              type="text"
              value={title}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              className={cx(FIELD, 'w-full')}
            />
          </label>

          <label className={FIELD_LABEL}>
            <span>Read aloud</span>
            <textarea
              rows={3}
              value={readAloud}
              disabled={busy}
              onChange={(e) => setReadAloud(e.target.value)}
              className={cx(FIELD, 'w-full resize-y font-sans')}
            />
          </label>

          <label className={FIELD_LABEL}>
            <span>If they push</span>
            <textarea
              rows={2}
              value={push}
              disabled={busy}
              onChange={(e) => setPush(e.target.value)}
              className={cx(FIELD, 'w-full resize-y font-sans')}
            />
          </label>

          <label className="box-border flex flex-col gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/20 p-2.5">
            <span className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-rose-400">DM only</span>
              <span className="text-[0.6875rem] font-semibold text-rose-200/80">DM truth</span>
            </span>
            <textarea
              rows={2}
              value={dmTruth}
              disabled={busy}
              onChange={(e) => setDmTruth(e.target.value)}
              className={cx(FIELD, 'w-full resize-y border-rose-500/40 font-sans focus:border-rose-400')}
            />
          </label>

          <label className={FIELD_LABEL}>
            <span>Tier</span>
            <select
              value={tier}
              disabled={busy}
              onChange={(e) => setTier(e.target.value as LoreTier)}
              className={cx(FIELD, 'w-full')}
            >
              <option value="open">Open</option>
              <option value="guarded">Guarded</option>
              <option value="deep">Deep</option>
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
              Save and answer
            </button>
          </div>
        </form>
      )}

      {errors.length > 0 && (
        <ul role="alert" className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-xs text-rose-300">
          {errors.map((err, index) => (
            <li key={index}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
