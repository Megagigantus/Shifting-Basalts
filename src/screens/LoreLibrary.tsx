// A player's Lore Library: revealed lore cards grouped by deck section, locked "???"
// placeholders for unseen cards, and read-only overlay playback when reopening a note.
import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { LoreNote } from '../lore/reveal'
import { useLoreNotes, useLoreSummary } from '../lore/useLoreLibrary'
import { LoreRevealOverlay } from './LoreRevealOverlay'

type ArchiveNote = LoreNote & { revealedAtMs: number }

/** Player's lore archive for `email`, showing revealed notes by group and "???" for remaining cards. */
export function LoreLibrary({ email }: { email: string }) {
  const summary = useLoreSummary()
  const notes = useLoreNotes(email)
  const [selected, setSelected] = useState<ArchiveNote | null>(null)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  if (!email.trim()) {
    return <p className="m-0 text-xs text-stone-400">No player is assigned to this character yet.</p>
  }

  if (summary === null || notes === null) {
    return <p className="m-0 text-xs text-stone-400">Loading lore…</p>
  }

  const countedCount = notes.filter((n) => n.counted).length
  const displayCount = summary.total > 0 ? Math.min(countedCount, summary.total) : countedCount
  const summaryGroupIds = new Set(summary.groups.map((g) => g.id))
  const otherNotes = notes.filter((n) => !n.counted || !summaryGroupIds.has(n.group))

  function markImageFailed(key: string) {
    setFailedImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  function renderNoteCard(note: ArchiveNote, index: number) {
    const noteKey = `${note.revealId || 'note'}-${index}`
    const showImage = Boolean(note.imageUrl) && !failedImages[noteKey]
    return (
      <button
        key={noteKey}
        type="button"
        onClick={() => setSelected(note)}
        className="group box-border flex min-w-0 w-full cursor-pointer flex-col overflow-hidden rounded-lg border border-sky-500/30 bg-stone-950/75 p-0 text-left transition-colors hover:border-sky-400/60 hover:bg-stone-900/90"
      >
        <div
          className="relative aspect-video w-full overflow-hidden"
          style={{
            background:
              'radial-gradient(ellipse at 50% 35%, #242129 0%, #141218 55%, #09080b 100%)',
          }}
        >
          {showImage && note.imageUrl && (
            <img
              src={note.imageUrl}
              alt=""
              aria-hidden="true"
              onError={() => markImageFailed(noteKey)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          )}
        </div>
        <span className="box-border w-full break-words px-2.5 py-2 text-xs font-semibold text-stone-100">
          {note.title}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-xs text-stone-300">
        {summary.total === 0 && notes.length === 0
          ? 'No Archival Indexes yet.'
          : `${displayCount} of ${summary.total} Archival Indexes`}
      </p>

      {summary.groups.map((group) => {
        const groupNotes = notes.filter((n) => n.counted && n.group === group.id)
        const revealed = groupNotes.length
        const lockedCount = Math.max(0, group.count - revealed)
        return (
          <section key={group.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="m-0 text-sm font-bold text-stone-100">{group.name}</h3>
              <span className="font-mono text-xs text-stone-400">
                {revealed} of {group.count}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {groupNotes.map((note, i) => renderNoteCard(note, i))}
              {Array.from({ length: lockedCount }, (_, i) => (
                <div
                  key={`locked-${group.id}-${i}`}
                  className="box-border flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-stone-800 bg-stone-950/60 p-2 text-stone-500"
                >
                  <Lock size={16} aria-hidden="true" />
                  <span className="font-mono text-xs font-semibold">???</span>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {otherNotes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-sm font-bold text-stone-100">Other notes</h3>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {otherNotes.map((note, i) => renderNoteCard(note, i))}
          </div>
        </section>
      )}

      {selected && (
        <LoreRevealOverlay
          key={selected.revealId}
          readOnly
          reveal={{
            revealId: selected.revealId,
            stage: 'more',
            title: selected.title,
            imageUrl: selected.imageUrl,
            push: selected.push,
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
