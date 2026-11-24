import { useEffect, useRef, useState } from 'react'
import { SkipForward, Sparkles } from 'lucide-react'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'
import { setMomentStatus, useMomentQueue } from './momentStore'
import { momentModule } from './registry'
import { THEME } from './theme'

const DONE_GRACE_MS = 1000
const SKIP_ERROR_MS = 3000

// Kept outside React state so moving to the next queued moment never cancels
// the delayed 'done' write for a moment that players may still be finishing.
const doneTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleMomentDone(runId: string, momentId: string, delayMs: number): void {
  if (doneTimers.has(momentId)) return
  const timer = setTimeout(() => {
    doneTimers.delete(momentId)
    void setMomentStatus(runId, momentId, 'done').catch(() => {})
  }, Math.max(0, delayMs))
  doneTimers.set(momentId, timer)
}

function cancelMomentDone(momentId: string): void {
  const timer = doneTimers.get(momentId)
  if (timer !== undefined) {
    clearTimeout(timer)
    doneTimers.delete(momentId)
  }
}

function ProgressBar({ durationMs }: { durationMs: number }) {
  const barRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    // Flush the initial scaleX(0) layout before switching to scaleX(1) so the transition runs.
    barRef.current?.getBoundingClientRect()
    const raf = requestAnimationFrame(() => {
      setStarted(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="h-1 w-full overflow-hidden bg-stone-800" aria-hidden="true">
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-violet-500 via-indigo-400 to-sky-400"
        style={{
          transform: started ? 'scaleX(1)' : 'scaleX(0)',
          transitionProperty: 'transform',
          transitionDuration: `${durationMs}ms`,
          transitionTimingFunction: 'linear',
        }}
      />
    </div>
  )
}

/** Compact DM "now playing" card for active cinematic moments, with a Skip button. */
export function MomentIndicator({ runId, names }: { runId: string; names: Record<string, string> }) {
  const { current, waitingCount, finish } = useMomentQueue(runId, { kind: 'dm' })
  const [skippingId, setSkippingId] = useState<string | null>(null)
  const [skipErrorId, setSkipErrorId] = useState<string | null>(null)

  const moment = current?.moment ?? null
  const currentId = moment?.id ?? null
  const currentSkipped = current?.skipped ?? false
  const mod = moment ? momentModule(moment.type) : null
  const label = mod ? mod.label : 'Moment'
  const description = moment ? (mod ? mod.describe(moment, names) : 'Unknown moment type') : ''
  const estimateMs = moment && mod ? Math.max(0, mod.estimateMs(moment)) : 0

  // Skip immediately if another DM device skipped this moment.
  useEffect(() => {
    if (!currentId || !currentSkipped) return
    cancelMomentDone(currentId)
    finish(currentId)
  }, [currentId, currentSkipped, finish])

  // Advance locally when the reveal finishes, and mark 'done' only after late preloads could finish.
  useEffect(() => {
    if (!currentId || currentSkipped) return
    scheduleMomentDone(runId, currentId, estimateMs + THEME.playback.preloadTimeoutMs + DONE_GRACE_MS)
    const timer = setTimeout(() => {
      finish(currentId)
    }, estimateMs)
    return () => clearTimeout(timer)
  }, [runId, currentId, currentSkipped, estimateMs, finish])

  useEffect(() => {
    if (!skipErrorId) return
    const timer = setTimeout(() => setSkipErrorId(null), SKIP_ERROR_MS)
    return () => clearTimeout(timer)
  }, [skipErrorId])

  if (!moment) return null

  const isSkipping = skippingId === moment.id
  const showSkipError = skipErrorId === moment.id

  async function handleSkip() {
    if (!moment || skippingId === moment.id) return
    const id = moment.id
    setSkippingId(id)
    setSkipErrorId((prev) => (prev === id ? null : prev))
    try {
      await setMomentStatus(runId, id, 'skipped')
      cancelMomentDone(id)
      finish(id)
    } catch {
      setSkipErrorId(id)
    } finally {
      setSkippingId((prev) => (prev === id ? null : prev))
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[65] ml-auto max-w-80 overflow-hidden rounded-xl border border-violet-500/40 bg-stone-900/95 text-stone-100 shadow-2xl shadow-black/60 backdrop-blur sm:left-auto sm:w-80"
    >
      <div className="flex items-start gap-2.5 p-3">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="m-0 truncate text-xs font-semibold leading-snug text-stone-100">
              Now playing: {label}
            </p>
            {waitingCount > 0 && (
              <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums text-sky-200">
                +{waitingCount} queued
              </span>
            )}
          </div>
          <p className="m-0 mt-0.5 text-[0.6875rem] leading-snug text-stone-300">{description}</p>
          {showSkipError && (
            <p className="m-0 mt-1 text-[0.6875rem] font-semibold text-sky-300">Couldn't skip</p>
          )}
        </div>
        <button
          type="button"
          disabled={isSkipping}
          onClick={handleSkip}
          className={cx(
            SMALL_BUTTON,
            'shrink-0 border-indigo-500/40 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30',
          )}
        >
          <SkipForward size={12} aria-hidden="true" />
          Skip
        </button>
      </div>
      <ProgressBar key={moment.id} durationMs={estimateMs} />
    </div>
  )
}
