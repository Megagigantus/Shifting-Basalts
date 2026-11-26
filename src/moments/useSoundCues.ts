import { useEffect, useRef } from 'react'
import type { RunState } from '../model/run'
import { playSound, preloadSounds } from './audio'
import { SOUND_CUES, cuePlaysOn, cuesFromChange } from './soundCues'
import type { MomentViewer } from './types'

/** Play sound cues on the Table display or a player's phone when the shared run changes. */
export function useSoundCues(state: RunState | null, viewer: MomentViewer): void {
  const prevStateRef = useRef<RunState | null>(null)
  const viewerRef = useRef(viewer)

  useEffect(() => {
    viewerRef.current = viewer
  })

  useEffect(() => {
    const keys = Object.entries(SOUND_CUES)
      .filter(([, screens]) => screens !== 'own')
      .map(([key]) => key)
    void preloadSounds(keys)
  }, [])

  // Depend on the inner objects: TableDisplay rebuilds the wrapper on every render.
  const run = state?.run ?? null
  const players = state?.players ?? null

  useEffect(() => {
    const current: RunState | null = run && players ? { run, players } : null
    const prev = prevStateRef.current
    prevStateRef.current = current
    if (!current) return

    const keysToPlay = new Set<string>()
    for (const event of cuesFromChange(prev, current)) {
      if (cuePlaysOn(event, viewerRef.current)) {
        keysToPlay.add(event.key)
      }
    }
    for (const key of keysToPlay) {
      playSound(key)
    }
  }, [run, players])
}
