// Full-screen lore card reveal overlay for players and the Table display, plus a
// read-only viewer mode for reopening archived notes in the Library.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Minimize2, Scroll, X } from 'lucide-react'
import type { LoreRevealDoc } from '../lore/reveal'
import { usePlayerLoreReveal } from '../lore/useLoreReveal'
import { usePrefersReducedMotion } from '../moments/device'
import { cx } from '../ui/tone'

const KEYFRAMES = `
@keyframes lore-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes lore-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes lore-slow-zoom {
  from { transform: scale(1); }
  to { transform: scale(1.08); }
}
`

interface OverlayProps {
  reveal: LoreRevealDoc
  /** Library mode: shows all present text, swaps Minimize for Close, and never auto-fades. */
  readOnly?: boolean
  /** Optional callback invoked when the user closes a read-only overlay. */
  onClose?: () => void
}

/**
 * Listens for the active lore reveal targeting any of `characterIds` (or `['_table']`)
 * and mounts a keyed `LoreRevealOverlay` whenever one exists.
 */
export function LoreRevealLayer({
  runId,
  characterIds,
}: {
  runId: string
  characterIds: string[]
}) {
  const reveal = usePlayerLoreReveal(runId, characterIds)
  if (!reveal) return null
  return <LoreRevealOverlay reveal={reveal} key={reveal.revealId} />
}

/**
 * Full-screen lore reveal overlay handling `image`, `text`, `more`, and `closed` stages,
 * minimize-to-chip, `prefers-reduced-motion`, and `readOnly` note playback.
 */
export function LoreRevealOverlay({ reveal, readOnly = false, onClose }: OverlayProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [mountedOpen] = useState(() => reveal.stage !== 'closed')
  const [minimized, setMinimized] = useState(false)
  const [closedDone, setClosedDone] = useState(false)
  const [readOnlyDismissed, setReadOnlyDismissed] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const isClosing = !readOnly && reveal.stage === 'closed'
  const closeFadeMs = reducedMotion ? 200 : 700

  useEffect(() => {
    if (!isClosing || !mountedOpen || closedDone) return
    const timer = setTimeout(() => {
      setClosedDone(true)
    }, closeFadeMs)
    return () => clearTimeout(timer)
  }, [isClosing, mountedOpen, closedDone, closeFadeMs])

  const handleReadOnlyClose = useCallback(() => {
    setReadOnlyDismissed(true)
    onClose?.()
  }, [onClose])

  useEffect(() => {
    if (!readOnly || readOnlyDismissed) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleReadOnlyClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readOnly, readOnlyDismissed, handleReadOnlyClose])

  if (readOnly && readOnlyDismissed) return null
  if (!readOnly && (!mountedOpen || closedDone)) return null

  const fadeMs = reducedMotion ? 200 : 600
  const titleFadeMs = reducedMotion || readOnly ? 200 : 600
  const titleDelayMs = reducedMotion || readOnly ? 0 : 800

  const showReadAloud =
    typeof reveal.readAloud === 'string' &&
    reveal.readAloud.trim().length > 0 &&
    (readOnly || reveal.stage === 'text' || reveal.stage === 'more' || reveal.stage === 'closed')

  const showPush =
    typeof reveal.push === 'string' &&
    reveal.push.trim().length > 0 &&
    (readOnly || reveal.stage === 'more' || reveal.stage === 'closed')

  const showImage = Boolean(reveal.imageUrl) && failedImageUrl !== reveal.imageUrl

  if (!readOnly && minimized) {
    return (
      <>
        <style>{KEYFRAMES}</style>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="box-border fixed bottom-4 left-1/2 z-[80] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-amber-500/40 bg-stone-950/90 px-4 py-2 text-sm font-medium text-amber-200 shadow-xl backdrop-blur-md transition-colors hover:border-amber-400/60 hover:bg-stone-900"
          style={
            isClosing
              ? { animation: `lore-fade-out ${closeFadeMs}ms ease-out forwards` }
              : { animation: `lore-fade-in ${reducedMotion ? 200 : 250}ms ease-out both` }
          }
        >
          <Scroll size={16} aria-hidden="true" className="shrink-0 text-amber-300" />
          <span className="truncate">{reveal.title}</span>
        </button>
      </>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reveal.title}
      className="fixed inset-0 z-[80] flex flex-col justify-between overflow-hidden bg-black"
      style={{
        animation: isClosing
          ? `lore-fade-out ${closeFadeMs}ms ease-out forwards`
          : `lore-fade-in ${readOnly && !reducedMotion ? 250 : fadeMs}ms ease-out both`,
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Base dark gradient fallback (also visible behind loading or missing art) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 35%, #242129 0%, #141218 55%, #09080b 100%)',
        }}
      />

      {showImage && reveal.imageUrl && (
        <img
          src={reveal.imageUrl}
          alt={reveal.title}
          onError={() => setFailedImageUrl(reveal.imageUrl)}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
          style={
            reducedMotion
              ? undefined
              : {
                  transformOrigin: 'center center',
                  animation: 'lore-slow-zoom 20s ease-out forwards',
                }
          }
        />
      )}

      {/* Calm top-to-bottom dark vignette so top controls and bottom title stay legible */}
      <div
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute inset-0 bg-gradient-to-t',
          showReadAloud || showPush
            ? 'from-black/95 via-black/65 to-black/25'
            : 'from-black/90 via-black/25 to-black/15',
        )}
      />

      {/* Top-right control: Close in readOnly mode, Minimize during live reveals */}
      <div className="pointer-events-none relative z-10 flex justify-end p-3 sm:p-5">
        {readOnly ? (
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={handleReadOnlyClose}
            className="box-border pointer-events-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-stone-600/80 bg-stone-950/80 p-2 text-stone-200 backdrop-blur-sm transition-colors hover:bg-stone-800 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Minimize"
            onClick={() => setMinimized(true)}
            className="box-border pointer-events-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-stone-600/80 bg-stone-950/80 p-2 text-stone-200 backdrop-blur-sm transition-colors hover:bg-stone-800 hover:text-white"
          >
            <Minimize2 size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Bottom-anchored title and revealed lore text */}
      <div className="box-border relative z-10 mt-auto w-full px-4 pt-8 pb-6 sm:px-8 sm:pb-10">
        <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-3">
          <h2
            className="m-0 select-text font-serif text-2xl font-semibold tracking-wide text-amber-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-3xl"
            style={{
              animation: `lore-fade-in ${titleFadeMs}ms ease-out ${titleDelayMs}ms both`,
            }}
          >
            {reveal.title}
          </h2>

          {(showReadAloud || showPush) && (
            <div
              className="box-border max-h-[48dvh] overflow-y-auto rounded-xl border border-stone-800/70 bg-stone-950/75 px-4 py-3.5 shadow-xl backdrop-blur-sm sm:max-h-[50dvh] sm:px-6 sm:py-4"
              style={{
                animation: `lore-fade-in ${fadeMs}ms ease-out both`,
              }}
            >
              {showReadAloud && (
                <p
                  className="m-0 select-text whitespace-pre-line font-serif text-base leading-relaxed text-stone-100 sm:text-lg sm:leading-relaxed"
                  style={{
                    animation: `lore-fade-in ${fadeMs}ms ease-out both`,
                  }}
                >
                  {reveal.readAloud}
                </p>
              )}

              {showPush && (
                <p
                  className={cx(
                    'm-0 select-text whitespace-pre-line text-sm italic leading-relaxed text-stone-400 sm:text-base',
                    showReadAloud && 'mt-3 border-t border-stone-800/80 pt-3',
                  )}
                  style={{
                    animation: `lore-fade-in ${fadeMs}ms ease-out both`,
                  }}
                >
                  {reveal.push}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
