// Timeline helpers for the hidden boon eye-opening reveal (see EyeLids.tsx).
import gsap from 'gsap'
import type { EyeRefs } from './EyeLids'

/** Reset the eye overlay to its closed starting state before the timeline plays. */
export function resetEye(refs: EyeRefs | undefined, reducedMotion: boolean): void {
  if (!refs) return
  if (refs.lidTop) gsap.set(refs.lidTop, { yPercent: 0, opacity: 1 })
  if (refs.lidBottom) gsap.set(refs.lidBottom, { yPercent: 0, opacity: 1 })
  if (refs.slit) gsap.set(refs.slit, { opacity: 0, scaleY: reducedMotion ? 1 : 0.15 })
  if (refs.iris) gsap.set(refs.iris, { opacity: 0, scale: 0.3 })
}

/** Add the closed-slit pulse and eye-opening reveal animation to a GSAP timeline. */
export function addEyeOpen(
  tl: gsap.core.Timeline,
  refs: EyeRefs | undefined,
  opts: {
    hesitationStart: number
    openStart: number
    openSec: number
    reducedMotion: boolean
  },
): void {
  if (!refs) return
  const { hesitationStart, openStart, openSec, reducedMotion } = opts
  const hesSec = openStart - hesitationStart

  if (reducedMotion) {
    if (refs.slit) {
      if (hesSec >= 0.1) {
        tl.to(
          refs.slit,
          { opacity: 0.9, duration: Math.min(0.3, hesSec * 0.5), ease: 'none' },
          hesitationStart,
        )
      } else {
        tl.set(refs.slit, { opacity: 0.9 }, openStart)
      }
    }
    const fadeTargets = [refs.lidTop, refs.lidBottom, refs.slit].filter(
      (el): el is SVGSVGElement | HTMLDivElement => el !== null,
    )
    if (fadeTargets.length > 0) {
      tl.to(fadeTargets, { opacity: 0, duration: openSec, ease: 'none' }, openStart)
    }
    return
  }

  if (refs.slit) {
    if (hesSec < 0.1) {
      tl.set(refs.slit, { opacity: 0.9, scaleY: 1 }, openStart)
    } else {
      const fadeInDur = Math.min(0.25, hesSec * 0.35)
      tl.to(
        refs.slit,
        { opacity: 0.9, scaleY: 1, duration: fadeInDur, ease: 'power2.out' },
        hesitationStart,
      )
      const pulseStart = hesitationStart + fadeInDur
      const pulseAvail = openStart - pulseStart
      if (pulseAvail >= 0.15) {
        const cycles = Math.max(1, Math.floor(pulseAvail / 0.45))
        const halfDur = pulseAvail / (cycles * 2)
        tl.to(
          refs.slit,
          {
            opacity: 0.6,
            duration: halfDur,
            yoyo: true,
            repeat: cycles * 2 - 1,
            ease: 'sine.inOut',
          },
          pulseStart,
        )
      }
    }
    tl.to(refs.slit, { opacity: 0, duration: openSec * 0.4, ease: 'power1.out' }, openStart)
  }

  if (refs.lidTop) {
    tl.to(refs.lidTop, { yPercent: -80, duration: openSec, ease: 'power3.inOut' }, openStart)
    tl.set(refs.lidTop, { opacity: 0 }, openStart + openSec)
  }
  if (refs.lidBottom) {
    tl.to(refs.lidBottom, { yPercent: 80, duration: openSec, ease: 'power3.inOut' }, openStart)
    tl.set(refs.lidBottom, { opacity: 0 }, openStart + openSec)
  }

  if (refs.iris) {
    const peakDur = openSec * 0.3
    const expandDur = openSec * 0.7
    tl.to(refs.iris, { opacity: 1, duration: peakDur, ease: 'power2.out' }, openStart)
    tl.to(
      refs.iris,
      { scale: 1.8, opacity: 0, duration: expandDur, ease: 'power2.out' },
      openStart + peakDur,
    )
  }
}
