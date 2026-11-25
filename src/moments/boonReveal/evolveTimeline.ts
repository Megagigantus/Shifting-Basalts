// Timeline helpers for Evolution card charge-up cracks, white flash, and shockwave burst (see EvolveFx.tsx).
import gsap from 'gsap'
import type { EvolveRefs } from './EvolveFx'

/** Reset Evolution effects before the timeline plays: all hidden, so a face-down card gives nothing away. */
export function resetEvolveFx(refs: EvolveRefs | undefined): void {
  if (!refs) return
  if (refs.cracks) {
    gsap.set(refs.cracks, { opacity: 0 })
    const paths = refs.cracks.querySelectorAll('path')
    if (paths.length > 0) {
      gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 })
    }
  }
  if (refs.flash) {
    gsap.set(refs.flash, { opacity: 0 })
  }
  if (refs.shock) {
    gsap.set(refs.shock, { opacity: 0, scale: 0.3 })
  }
}

/** Draw energy cracks across the card back during the Evolution hesitation charge-up. */
export function addEvolveCharge(
  tl: gsap.core.Timeline,
  refs: EvolveRefs | undefined,
  opts: {
    start: number
    end: number
    reducedMotion: boolean
  },
): void {
  if (!refs || opts.reducedMotion || !refs.cracks) return
  const paths = refs.cracks.querySelectorAll('path')
  if (paths.length === 0) return

  const { start, end } = opts
  const drawStart = start + (end - start) * 0.25
  const duration = end - drawStart
  if (duration <= 0) return

  // Cracks show only once this card's charge-up starts drawing them.
  tl.set(refs.cracks, { opacity: 1 }, drawStart)
  tl.to(
    paths,
    { strokeDashoffset: 0, duration, ease: 'power2.in' },
    drawStart,
  )
}

/** Trigger the white flash, crack fade, and expanding shockwave burst when an Evolution card flips. */
export function addEvolveBurst(
  tl: gsap.core.Timeline,
  refs: EvolveRefs | undefined,
  opts: {
    at: number
    reducedMotion: boolean
  },
): void {
  if (!refs) return
  const { at, reducedMotion } = opts

  if (reducedMotion) {
    if (refs.flash) {
      tl.to(
        refs.flash,
        { opacity: 0.5, duration: 0.2, yoyo: true, repeat: 1, ease: 'sine.inOut' },
        at,
      )
    }
    return
  }

  if (refs.flash) {
    tl.to(refs.flash, { opacity: 1, duration: 0.08, ease: 'power2.out' }, at)
    tl.to(refs.flash, { opacity: 0, duration: 0.45, ease: 'power2.out' }, at + 0.08)
  }
  if (refs.cracks) {
    tl.to(refs.cracks, { opacity: 0, duration: 0.15, ease: 'power1.out' }, at)
  }
  if (refs.shock) {
    tl.fromTo(
      refs.shock,
      { scale: 0.3, opacity: 1 },
      { scale: 2.6, opacity: 0, duration: 0.7, ease: 'power2.out', immediateRender: false },
      at,
    )
  }
}
