// The "claimed" flourish on draft cards: which card was taken, and the
// inline style each card gets (chosen brightens, others fade like afterimages).
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { playSound } from '../audio'
import { THEME } from '../theme'

/** Track which card was claimed and clear it if an in-flight choice is cancelled or fails. */
export function useClaim(busy: boolean): { claimed: string | null; claim: (key: string) => void } {
  const [claimed, setClaimed] = useState<string | null>(null)
  const prevBusy = useRef(busy)

  useEffect(() => {
    if (prevBusy.current && !busy) {
      setClaimed(null)
    }
    prevBusy.current = busy
  }, [busy])

  const claim = useCallback((key: string) => {
    setClaimed(key)
    playSound('claimed')
  }, [])

  return { claimed, claim }
}

/** Inline transition style for a card in idle, claimed, or released (afterimage) state. */
export function claimStyle(
  state: 'claimed' | 'released' | 'idle',
  reducedMotion: boolean,
): CSSProperties {
  if (state === 'idle') return {}
  const { claimMs, fadeOutMs } = THEME.timings
  if (state === 'claimed') {
    return reducedMotion
      ? { opacity: 1, transition: `opacity ${claimMs}ms ease` }
      : {
          transform: 'scale(1.03)',
          opacity: 1,
          transition: `transform ${claimMs}ms ease, opacity ${claimMs}ms ease`,
        }
  }
  return reducedMotion
    ? {
        opacity: 0.25,
        transition: `opacity ${fadeOutMs}ms ease`,
        pointerEvents: 'none',
      }
    : {
        opacity: 0.25,
        transform: 'translateY(6px) scale(0.98)',
        transition: `transform ${fadeOutMs}ms ease, opacity ${fadeOutMs}ms ease`,
        pointerEvents: 'none',
      }
}
