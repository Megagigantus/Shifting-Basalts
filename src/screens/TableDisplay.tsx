// Player-safe shared screen for a second monitor or TV: shows only the
// current room, party status, and table moments, never DM-only state.
import { useEffect, useState } from 'react'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import type { RunState } from '../model/run'
import { MomentLayer } from '../moments/MomentLayer'
import { SoundPrompt, SoundSettingsButton } from '../moments/SoundControls'
import { LoreRevealLayer } from './LoreRevealOverlay'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'
import { PlayerRoom } from './PlayerRoom'

function supportsFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  return (
    document.fullscreenEnabled !== false &&
    typeof document.documentElement?.requestFullscreen === 'function' &&
    typeof document.exitFullscreen === 'function'
  )
}

/** Full-screen, player-safe table display showing the current room, party, and table moments. */
export function TableDisplay({ state, onExit }: { state: RunState | null; onExit: () => void }) {
  // Strip any DM-only properties before passing state to child components.
  const safe: RunState | null = state ? { run: state.run, players: state.players } : null
  const isActive = safe !== null && safe.run.status === 'active'
  const canFullscreen = supportsFullscreen()

  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  )

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  const locationLabel = isActive
    ? safe.run.roomView
      ? `Floor ${safe.run.floor} · Room ${safe.run.room}`
      : 'Between floors'
    : 'Table display'

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-4 text-stone-100 sm:px-8 sm:py-6">
      {isActive && <MomentLayer runId={safe.run.id} viewer={{ kind: 'table' }} />}
      {isActive && <LoreRevealLayer runId={safe.run.id} characterIds={['_table']} />}
      {isActive && <SoundPrompt />}

      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-800/90 bg-stone-900/85 px-4 py-2.5 backdrop-blur">
        <div className="text-sm font-semibold tracking-wide text-stone-200">{locationLabel}</div>

        {isActive && safe.players.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Party">
            {safe.players.map((p) => (
              <span
                key={p.characterId}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  p.alive
                    ? 'border-stone-700 bg-stone-950/80 text-stone-100'
                    : 'border-stone-800 bg-stone-950/50 text-stone-400 opacity-55',
                )}
              >
                <span>{p.name}</span>
                {!p.alive && <span className="text-[0.6875rem] text-stone-500">fallen</span>}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <SoundSettingsButton />
          {canFullscreen && (
            <button type="button" onClick={toggleFullscreen} className={SMALL_BUTTON}>
              {isFullscreen ? <Minimize2 size={13} aria-hidden="true" /> : <Maximize2 size={13} aria-hidden="true" />}
              {isFullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className={cx(
              SMALL_BUTTON,
              'border-stone-800 bg-transparent text-stone-400 hover:bg-stone-800/70 hover:text-stone-200',
            )}
          >
            <ArrowLeft size={13} aria-hidden="true" />
            Exit table display
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4">
        {isActive && safe.run.roomView ? (
          <PlayerRoom state={safe} me={null} readOnly myCharacterIds={[]} tableView />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="m-0 rounded-2xl border border-stone-800 bg-stone-900/75 px-6 py-4 text-sm text-stone-300 backdrop-blur">
              {isActive ? 'Waiting for the next room…' : 'No run in progress.'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
