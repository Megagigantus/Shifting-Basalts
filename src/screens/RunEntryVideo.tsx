// Players only: the tunnel video the first time they see a run, once per run
// on each device. It tries to play with sound; if the browser blocks that, it
// plays muted with a Sound button. Skip, the end of the video, or Esc closes it.
// The browser remembers it was seen (if storage is blocked, it may show again).
import { useEffect, useRef, useState } from 'react'
import { SkipForward, Volume2, VolumeX } from 'lucide-react'
import videoUrl from '../media/basalts-entering.mp4?url'
import { PRIMARY_BUTTON, QUIET_BUTTON } from '../ui/styles'

const seenKey = (runId: string) => `sb-entered-run:${runId}`

function wasSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Storage blocked: the video may play again next time, which is harmless.
  }
}

export function RunEntryVideo({ runId }: { runId: string }) {
  const key = seenKey(runId)
  const [open, setOpen] = useState(() => !wasSeen(key))
  const [muted, setMuted] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!open) return
    markSeen(key)
    const v = video.current
    if (!v) return
    v.muted = false
    v.play().catch(() => {
      // Sound blocked until the player interacts: play muted instead.
      v.muted = true
      setMuted(true)
      v.play().catch(() => setOpen(false))
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, key])

  if (!open) return null

  function toggleSound() {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Entering the Shifting Basalts" className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4">
      <div className="flex w-full max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-sm font-bold uppercase tracking-wider text-amber-300">Entering the Shifting Basalts…</h2>
          <div className="flex gap-2">
            <button type="button" onClick={toggleSound} className={QUIET_BUTTON}>
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? 'Sound on' : 'Mute'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={PRIMARY_BUTTON} autoFocus>
              <SkipForward size={14} /> Skip
            </button>
          </div>
        </div>
        <video
          ref={video}
          src={videoUrl}
          playsInline
          preload="auto"
          onEnded={() => setOpen(false)}
          className="aspect-video w-full rounded-2xl border border-amber-500/30 bg-black object-cover"
        />
      </div>
    </div>
  )
}
