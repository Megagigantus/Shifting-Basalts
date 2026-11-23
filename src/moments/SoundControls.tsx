import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { PRIMARY_BUTTON, QUIET_BUTTON, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'
import { unlockAudio, useAudioUnlocked } from './audio'
import { useDeviceSettings } from './device'

let promptDismissed = false
const dismissListeners = new Set<() => void>()

function subscribeDismissed(listener: () => void): () => void {
  dismissListeners.add(listener)
  return () => {
    dismissListeners.delete(listener)
  }
}

function getDismissed(): boolean {
  return promptDismissed
}

function dismissPrompt(): void {
  if (promptDismissed) return
  promptDismissed = true
  for (const listener of dismissListeners) {
    listener()
  }
}

/** One-time bottom banner asking the user to tap to unlock browser audio for this page load. */
export function SoundPrompt() {
  const [settings] = useDeviceSettings()
  const unlocked = useAudioUnlocked()
  const dismissed = useSyncExternalStore(subscribeDismissed, getDismissed, () => false)

  if (!settings.soundOn || unlocked || dismissed) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-stone-700 bg-stone-900/95 px-3 py-2 text-stone-100 shadow-2xl shadow-black/60 backdrop-blur"
    >
      <button type="button" onClick={unlockAudio} className={PRIMARY_BUTTON}>
        <Volume2 size={16} aria-hidden="true" />
        Tap to enable sound
      </button>
      <button type="button" onClick={dismissPrompt} className={QUIET_BUTTON}>
        Not now
      </button>
    </div>
  )
}

/** Header button toggling a compact per-device sound on/off and volume popover. */
export function SoundSettingsButton() {
  const [settings, setDeviceSettings] = useDeviceSettings()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const volumePercent = Math.round(settings.volume * 100)

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label="Sound settings"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cx(SMALL_BUTTON, 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800')}
      >
        {settings.soundOn ? (
          <Volume2 size={14} aria-hidden="true" />
        ) : (
          <VolumeX size={14} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Sound settings"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-stone-700 bg-stone-900 p-3 text-xs text-stone-100 shadow-2xl shadow-black/60"
        >
          <label className="flex cursor-pointer items-center justify-between gap-2 font-semibold text-stone-200">
            <span>Sound</span>
            <input
              type="checkbox"
              checked={settings.soundOn}
              onChange={(e) => {
                const next = e.target.checked
                setDeviceSettings({ soundOn: next })
                if (next) unlockAudio()
              }}
              className="h-4 w-4 cursor-pointer accent-stone-300"
            />
          </label>

          <label
            className={cx(
              'mt-3 flex flex-col gap-1.5 font-semibold',
              settings.soundOn ? 'text-stone-200' : 'text-stone-500',
            )}
          >
            <span className="flex items-center justify-between">
              <span>Volume</span>
              <span className="tabular-nums text-stone-400">{volumePercent}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={volumePercent}
              disabled={!settings.soundOn}
              onChange={(e) => {
                setDeviceSettings({ volume: Number(e.target.value) / 100 })
                unlockAudio()
              }}
              className="w-full cursor-pointer accent-stone-300 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        </div>
      )}
    </div>
  )
}
