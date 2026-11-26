// DM-only panel for reading "The whole story" and showing each part's picture to players and the table.
import { useState, type ReactNode } from 'react'
import { BookOpen, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import type { LoreCard } from '../lore/types'
import {
  WHOLE_STORY,
  storyPartImageUrl,
  storyProgress,
  wholeStoryImageUrl,
} from '../lore/wholeStory'
import { closeStoryImage, showStoryImage } from '../lore/wholeStoryStore'
import { useActiveRun } from '../runStore'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { PRIMARY_BUTTON, QUIET_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'
import { LoreArt } from './LoreArt'

interface Props {
  cards: LoreCard[]
  seen: Record<string, number>
}

interface ActivePicture {
  key: string
  runId: string
  revealId: string
  title: string
  imageUrl: string | null
}

/** DM panel showing unlock progress, staging, read-aloud parts, coda, and picture reveal controls. */
export function WholeStoryPanel({ cards, seen }: Props) {
  const { state: activeRun } = useActiveRun()
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null)
  const [shown, setShown] = useState<ActivePicture | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const progress = storyProgress(cards, seen)
  const expanded = expandedOverride ?? progress.unlocked
  const activeShown = shown && activeRun && shown.runId === activeRun.run.id ? shown : null
  const busy = busyKey !== null
  const cardById = new Map(cards.map((card) => [card.id, card]))
  const codaImageUrl = wholeStoryImageUrl()

  async function handleShow(key: string, title: string, imageUrl: string | null) {
    if (!progress.unlocked || !activeRun || busy) return
    setBusyKey(key)
    setActionError(null)
    try {
      const characterIds = activeRun.players.map((player) => player.characterId)
      if (activeShown) {
        await closeStoryImage(
          activeShown.runId,
          characterIds,
          activeShown.revealId,
          activeShown.title,
          activeShown.imageUrl,
        )
        setShown(null)
      }
      const revealId = await showStoryImage(activeRun.run.id, characterIds, title, imageUrl)
      setShown({ key, runId: activeRun.run.id, revealId, title, imageUrl })
    } catch (err) {
      setActionError(err instanceof Error && err.message ? err.message : 'Could not show the story picture.')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleClose() {
    if (!activeRun || !activeShown || busy) return
    setBusyKey(activeShown.key)
    setActionError(null)
    try {
      const characterIds = activeRun.players.map((player) => player.characterId)
      await closeStoryImage(
        activeShown.runId,
        characterIds,
        activeShown.revealId,
        activeShown.title,
        activeShown.imageUrl,
      )
      setShown(null)
    } catch (err) {
      setActionError(err instanceof Error && err.message ? err.message : 'Could not close the story picture.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <Panel
      icon={<BookOpen size={16} />}
      title={WHOLE_STORY.title}
      tone={progress.unlocked ? 'amber' : 'stone'}
      actions={
        <>
          <Pill tone={progress.unlocked ? 'emerald' : 'stone'} mono>
            {progress.seen} of {progress.total} seen
          </Pill>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpandedOverride(!expanded)}
            className={QUIET_BUTTON}
          >
            {expanded ? (
              <>
                <ChevronUp size={14} aria-hidden="true" />
                Hide parts
              </>
            ) : (
              <>
                <ChevronDown size={14} aria-hidden="true" />
                Read parts
              </>
            )}
          </button>
        </>
      }
    >
      {!progress.unlocked && (
        <div className={cx(WELL, 'flex flex-wrap items-center justify-between gap-2')}>
          <span className="inline-flex items-center gap-1.5 text-xs text-stone-300">
            <Lock size={13} className="shrink-0 text-stone-400" aria-hidden="true" />
            Unlocks when every lore card has been seen
          </span>
          <span className="font-mono text-xs text-stone-400">
            {progress.seen} of {progress.total} seen
          </span>
        </div>
      )}

      {expanded && (
        <div className="flex flex-col gap-3">
          {!activeRun && (
            <p className="m-0 text-xs text-stone-400">
              No active run. Start a run to show pictures to players and the table display.
            </p>
          )}

          {actionError && (
            <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
              {actionError}
            </div>
          )}

          <div className={cx(WELL, 'flex flex-col gap-1')}>
            <SectionLabel>Staging (DM only)</SectionLabel>
            <p className="m-0 whitespace-pre-line text-xs leading-relaxed text-stone-300">
              {WHOLE_STORY.staging}
            </p>
          </div>

          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {WHOLE_STORY.parts.map((part, index) => {
              const partKey = `part-${index}`
              const imageUrl = storyPartImageUrl(part)
              const replayCard = part.replayCardId ? cardById.get(part.replayCardId) : undefined

              return (
                <li key={part.title}>
                  <StorySectionRow
                    heading={part.title}
                    note={
                      part.replayCardId ? (
                        <>
                          Replays card:{' '}
                          <span className="text-stone-200">{replayCard?.title ?? part.replayCardId}</span>
                        </>
                      ) : undefined
                    }
                    imageUrl={imageUrl}
                    imageAlt={part.title}
                    readAloud={part.readAloud}
                    shown={activeShown?.key === partKey}
                    busy={busyKey === partKey}
                    showDisabled={!progress.unlocked || !activeRun || busy}
                    closeDisabled={!activeRun || busy}
                    onShow={() => handleShow(partKey, part.title, imageUrl)}
                    onClose={handleClose}
                  />
                </li>
              )
            })}
          </ol>

          {WHOLE_STORY.coda.trim().length > 0 && (
            <StorySectionRow
              heading="Coda (optional)"
              headingClassName="text-amber-200"
              className="border-amber-500/30"
              note={WHOLE_STORY.codaNote || undefined}
              imageUrl={codaImageUrl}
              imageAlt={WHOLE_STORY.title}
              readAloud={WHOLE_STORY.coda}
              shown={activeShown?.key === 'coda'}
              busy={busyKey === 'coda'}
              showDisabled={!progress.unlocked || !activeRun || busy}
              closeDisabled={!activeRun || busy}
              onShow={() => handleShow('coda', WHOLE_STORY.title, codaImageUrl)}
              onClose={handleClose}
            />
          )}
        </div>
      )}
    </Panel>
  )
}

interface RowProps {
  heading: string
  headingClassName?: string
  className?: string
  note?: ReactNode
  imageUrl: string | null
  imageAlt: string
  readAloud: string
  shown: boolean
  busy: boolean
  showDisabled: boolean
  closeDisabled: boolean
  onShow: () => void
  onClose: () => void
}

function StorySectionRow({
  heading,
  headingClassName,
  className,
  note,
  imageUrl,
  imageAlt,
  readAloud,
  shown,
  busy,
  showDisabled,
  closeDisabled,
  onShow,
  onClose,
}: RowProps) {
  return (
    <div className={cx(WELL, 'flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md border border-stone-800 bg-stone-950 sm:w-36">
            {imageUrl && <LoreArt src={imageUrl} alt={imageAlt} />}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <strong className={cx('text-sm text-stone-100', headingClassName)}>{heading}</strong>
            {note && <span className="text-xs text-stone-400">{note}</span>}
          </div>
        </div>
        {shown ? (
          <button
            type="button"
            disabled={closeDisabled}
            onClick={onClose}
            className={QUIET_BUTTON}
          >
            {busy ? 'Closing…' : 'Close picture'}
          </button>
        ) : (
          <button
            type="button"
            disabled={showDisabled}
            onClick={onShow}
            className={PRIMARY_BUTTON}
          >
            {busy ? 'Showing…' : 'Show picture'}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel>Read aloud (DM only)</SectionLabel>
        <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-stone-100">{readAloud}</p>
      </div>
    </div>
  )
}
