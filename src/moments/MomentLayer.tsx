import { useCallback, useEffect, useRef, useState } from 'react'
import { preloadSounds, stopAllSounds } from './audio'
import { usePrefersReducedMotion } from './device'
import { useMomentQueue } from './momentStore'
import { momentModule } from './registry'
import { THEME } from './theme'
import type { Moment, MomentViewer } from './types'

const SAFETY_MARGIN_MS = 5000

function preloadImage(url: string): Promise<void> {
  if (typeof Image === 'undefined' || !url) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const img = new Image()
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      img.onload = null
      img.onerror = null
      resolve()
    }
    img.onload = done
    img.onerror = done
    img.src = url
    if (img.complete) done()
  })
}

function preloadImages(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.filter(Boolean))]
  if (unique.length === 0) return Promise.resolve()
  return Promise.all(unique.map(preloadImage)).then(() => {})
}

function preloadAssets(sounds: string[], images: string[], timeoutMs: number): Promise<void> {
  if (sounds.length === 0 && images.length === 0) return Promise.resolve()
  const waitMs = Math.max(0, timeoutMs)
  const work = Promise.all([preloadSounds(sounds, waitMs), preloadImages(images)])
  return new Promise<void>((resolve) => {
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, waitMs)
    work.then(done, done)
  })
}

/** Full-screen overlay playing queued cinematic moments on player and table screens. */
export function MomentLayer({ runId, viewer }: { runId: string | null; viewer: MomentViewer }) {
  const isDm = viewer.kind === 'dm'
  const { current, finish } = useMomentQueue(isDm ? null : runId, viewer)
  const reducedMotion = usePrefersReducedMotion()
  const [readyId, setReadyId] = useState<string | null>(null)

  const viewerRef = useRef(viewer)
  const currentMomentRef = useRef<Moment | null>(current?.moment ?? null)
  const skippedRef = useRef(current?.skipped ?? false)
  const finishedIdsRef = useRef(new Set<string>())

  useEffect(() => {
    viewerRef.current = viewer
    currentMomentRef.current = current?.moment ?? null
    skippedRef.current = current?.skipped ?? false
  })

  const completeMoment = useCallback(
    (id: string) => {
      if (finishedIdsRef.current.has(id)) return
      finishedIdsRef.current.add(id)
      if (finishedIdsRef.current.size > 100) {
        const oldest = finishedIdsRef.current.values().next().value
        if (oldest !== undefined) finishedIdsRef.current.delete(oldest)
      }
      finish(id)
    },
    [finish],
  )

  const currentId = !isDm && current ? current.moment.id : null
  const currentType = !isDm && current ? current.moment.type : null
  const mod = currentType !== null ? momentModule(currentType) : null
  const isReady = currentId !== null && readyId === currentId
  const isSkipped = Boolean(!isDm && current?.skipped)

  // Unknown moment types cannot play, so advance the queue right away.
  useEffect(() => {
    if (isDm || !currentId || mod) return
    completeMoment(currentId)
  }, [isDm, currentId, mod, completeMoment])

  // If skipped before preloading finishes, skip straight to finish(id).
  useEffect(() => {
    if (isDm || !currentId || !mod || isReady || !isSkipped) return
    completeMoment(currentId)
  }, [isDm, currentId, mod, isReady, isSkipped, completeMoment])

  // Preload assets when a new moment becomes current, bounded by preloadTimeoutMs.
  useEffect(() => {
    if (isDm || !currentId || !mod) return
    const moment = currentMomentRef.current
    if (!moment || moment.id !== currentId) return
    if (skippedRef.current) {
      completeMoment(currentId)
      return
    }

    let cancelled = false
    const assets = mod.preload ? mod.preload(moment, viewerRef.current) : { sounds: [], images: [] }
    void preloadAssets(assets.sounds, assets.images, THEME.playback.preloadTimeoutMs).then(() => {
      if (cancelled) return
      if (skippedRef.current) {
        completeMoment(currentId)
        return
      }
      setReadyId(currentId)
    })

    return () => {
      cancelled = true
    }
  }, [isDm, currentId, mod, completeMoment])

  // Safety timeout while playing, plus sound/timer cleanup on unmount or moment change.
  useEffect(() => {
    if (isDm || !isReady || !currentId || !mod) return
    const moment = currentMomentRef.current
    if (!moment || moment.id !== currentId) return

    const safetyMs = Math.max(0, mod.estimateMs(moment)) + SAFETY_MARGIN_MS
    const timer = setTimeout(() => {
      completeMoment(currentId)
    }, safetyMs)

    return () => {
      clearTimeout(timer)
      stopAllSounds()
    }
  }, [isDm, isReady, currentId, mod, completeMoment])

  const handleDone = useCallback(() => {
    if (currentId) completeMoment(currentId)
  }, [currentId, completeMoment])

  if (isDm || !current || !mod || !isReady) {
    return null
  }

  const { moment, skipped } = current
  const Player = mod.Player

  return (
    <div key={moment.id} className="fixed inset-0 z-[60]" aria-live="polite">
      <Player
        moment={moment}
        viewer={viewer}
        skipped={skipped}
        reducedMotion={reducedMotion}
        onDone={handleDone}
      />
    </div>
  )
}
