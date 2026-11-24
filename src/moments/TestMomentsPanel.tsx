import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Send, SkipForward } from 'lucide-react'
import { useActiveRun } from '../runStore'
import { Panel } from '../ui/Panel'
import { QUIET_BUTTON, SMALL_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'
import { preloadSounds, stopAllSounds, unlockAudio } from './audio'
import { usePrefersReducedMotion } from './device'
import { createMoment } from './momentStore'
import { momentModules, type MomentModule, type MomentSample, type SampleContext } from './registry'
import type { Moment, MomentViewer } from './types'

const SAFETY_MARGIN_MS = 5000
const SENT_FEEDBACK_MS = 2000

type ShowAs = 'player' | 'table'

interface LocalPreview {
  mod: MomentModule
  moment: Moment
  viewer: MomentViewer
}

interface SendFeedback {
  kind: 'sent' | 'error'
  text: string
}

function buildSampleContext(
  players: { characterId: string; name: string }[] | null,
): SampleContext {
  if (!players) {
    return {
      characterIds: ['sample-player'],
      names: { 'sample-player': 'Sample Player' },
    }
  }
  const characterIds = players.map((p) => p.characterId)
  const names: Record<string, string> = {}
  for (const player of players) {
    names[player.characterId] = player.name
  }
  return { characterIds, names }
}

/**
 * Collapsed-by-default DM developer panel to preview registered moment samples
 * locally or broadcast them to the active run's connected screens.
 */
export function TestMomentsPanel() {
  const { state } = useActiveRun()
  const activeRun = state?.run.status === 'active' ? state : null
  const hasActiveRun = activeRun !== null

  const deviceReducedMotion = usePrefersReducedMotion()
  const [reducedMotionOverride, setReducedMotionOverride] = useState<boolean | null>(null)
  const reducedMotion = reducedMotionOverride ?? deviceReducedMotion

  const [showAs, setShowAs] = useState<ShowAs>('player')
  const [preview, setPreview] = useState<LocalPreview | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [sendingKey, setSendingKey] = useState<string | null>(null)
  const [sendFeedback, setSendFeedback] = useState<Record<string, SendFeedback>>({})

  const mountedRef = useRef(true)
  const playRequestIdRef = useRef(0)
  const sentTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    mountedRef.current = true
    const timers = sentTimersRef.current
    return () => {
      mountedRef.current = false
      for (const timer of timers.values()) {
        clearTimeout(timer)
      }
      timers.clear()
    }
  }, [])

  const closePreview = useCallback(() => {
    playRequestIdRef.current += 1
    stopAllSounds()
    setPreview(null)
    setSkipped(false)
  }, [])

  // Safety timeout while playing locally, plus sound/timer cleanup on close or unmount.
  useEffect(() => {
    if (!preview) return
    const safetyMs = Math.max(0, preview.mod.estimateMs(preview.moment)) + SAFETY_MARGIN_MS
    const timer = setTimeout(() => {
      closePreview()
    }, safetyMs)
    return () => {
      clearTimeout(timer)
      stopAllSounds()
    }
  }, [preview, closePreview])

  const activeMomentId = preview?.moment.id ?? null
  useEffect(() => {
    if (!activeMomentId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setSkipped(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeMomentId])

  async function handlePlayHere(
    mod: MomentModule,
    sampleDef: MomentSample<Record<string, unknown>>,
  ) {
    unlockAudio()
    stopAllSounds()
    const requestId = ++playRequestIdRef.current

    const ctx = buildSampleContext(activeRun ? activeRun.players : null)
    const sample = sampleDef.build(ctx)
    const now = Date.now()
    const moment: Moment = {
      id: 'local-' + now,
      ...sample,
      createdAtMs: now,
      createdBy: 'local-test',
      status: 'playing',
    }
    const viewer: MomentViewer =
      showAs === 'player'
        ? { kind: 'player', characterIds: ctx.characterIds }
        : { kind: 'table' }

    if (mod.preload) {
      const { sounds } = mod.preload(moment, viewer)
      await preloadSounds(sounds)
    }

    if (!mountedRef.current || playRequestIdRef.current !== requestId) return

    setSkipped(false)
    setPreview({ mod, moment, viewer })
  }

  async function handleSendToRun(
    key: string,
    sampleDef: MomentSample<Record<string, unknown>>,
  ) {
    if (!activeRun || sendingKey === key) return

    const prevTimer = sentTimersRef.current.get(key)
    if (prevTimer !== undefined) {
      clearTimeout(prevTimer)
      sentTimersRef.current.delete(key)
    }

    setSendingKey(key)
    setSendFeedback((prev) => {
      if (!Object.hasOwn(prev, key)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })

    const ctx = buildSampleContext(activeRun.players)
    const sample = sampleDef.build(ctx)

    try {
      await createMoment(activeRun.run.id, sample)
      if (!mountedRef.current) return
      setSendFeedback((prev) => ({ ...prev, [key]: { kind: 'sent', text: 'Sent' } }))
      const timer = setTimeout(() => {
        sentTimersRef.current.delete(key)
        if (!mountedRef.current) return
        setSendFeedback((prev) => {
          if (prev[key]?.kind !== 'sent') return prev
          const next = { ...prev }
          delete next[key]
          return next
        })
      }, SENT_FEEDBACK_MS)
      sentTimersRef.current.set(key, timer)
    } catch (err) {
      if (!mountedRef.current) return
      const text = err instanceof Error && err.message ? err.message : 'Failed to send moment.'
      setSendFeedback((prev) => ({ ...prev, [key]: { kind: 'error', text } }))
    } finally {
      if (mountedRef.current) {
        setSendingKey((prev) => (prev === key ? null : prev))
      }
    }
  }

  const modules = momentModules()
  const PreviewPlayer = preview ? preview.mod.Player : null

  return (
    <>
      <details className="mt-2 border-t border-stone-800/80 pt-3">
        <summary className="cursor-pointer select-none text-xs font-semibold text-stone-400 hover:text-stone-200">
          Test moments (developer)
        </summary>

        <Panel
          className="mt-2"
          subtitle="Play reveal samples here, or send them to the current run's screens."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-400">Show as</span>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show as">
                <button
                  type="button"
                  aria-pressed={showAs === 'player'}
                  onClick={() => setShowAs('player')}
                  className={cx(
                    SMALL_BUTTON,
                    showAs === 'player'
                      ? 'border-sky-500/40 bg-sky-500/20 text-sky-200'
                      : 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800',
                  )}
                >
                  Player phone
                </button>
                <button
                  type="button"
                  aria-pressed={showAs === 'table'}
                  onClick={() => setShowAs('table')}
                  className={cx(
                    SMALL_BUTTON,
                    showAs === 'table'
                      ? 'border-sky-500/40 bg-sky-500/20 text-sky-200'
                      : 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800',
                  )}
                >
                  Table display
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-300">
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(e) => setReducedMotionOverride(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-violet-400"
              />
              <span>Reduced motion</span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            {modules.flatMap((mod) =>
              mod.samples.map((sample, index) => {
                const key = `${mod.type}-${index}`
                const feedback = sendFeedback[key]
                const isSending = sendingKey === key

                return (
                  <div
                    key={key}
                    className={cx(WELL, 'flex flex-wrap items-center justify-between gap-2')}
                  >
                    <span className="text-xs font-medium text-stone-200">{sample.label}</span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {feedback && (
                        <span
                          role={feedback.kind === 'error' ? 'alert' : 'status'}
                          className={cx(
                            'text-xs font-medium',
                            feedback.kind === 'sent' ? 'text-sky-300' : 'text-violet-300',
                          )}
                        >
                          {feedback.text}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => void handlePlayHere(mod, sample)}
                        className={cx(
                          SMALL_BUTTON,
                          'border-violet-500/40 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30',
                        )}
                      >
                        <Play size={11} aria-hidden="true" />
                        Play here
                      </button>

                      <button
                        type="button"
                        disabled={!hasActiveRun || isSending}
                        title={
                          !hasActiveRun
                            ? 'Start a run to send moments to players and the table.'
                            : undefined
                        }
                        onClick={() => void handleSendToRun(key, sample)}
                        className={cx(
                          SMALL_BUTTON,
                          'border-sky-500/40 bg-sky-500/20 text-sky-200 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:border-stone-800 disabled:bg-stone-900 disabled:text-stone-500',
                        )}
                      >
                        <Send size={11} aria-hidden="true" />
                        Send to run
                      </button>
                    </div>
                  </div>
                )
              }),
            )}
          </div>
        </Panel>
      </details>

      {preview && PreviewPlayer && (
        <>
          <div key={preview.moment.id} className="fixed inset-0 z-[60]" aria-live="polite">
            <PreviewPlayer
              moment={preview.moment}
              viewer={preview.viewer}
              skipped={skipped}
              reducedMotion={reducedMotion}
              onDone={closePreview}
            />
          </div>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className={cx(
              QUIET_BUTTON,
              'fixed bottom-4 right-4 z-[70] border-stone-700 bg-stone-900/90 text-stone-100 shadow-lg shadow-black/50 backdrop-blur hover:bg-stone-800',
            )}
          >
            <SkipForward size={13} aria-hidden="true" />
            Skip
          </button>
        </>
      )}
    </>
  )
}
