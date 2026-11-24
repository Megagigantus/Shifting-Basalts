// Timeline helpers for Fusion source card merge, radial flash, and shockwave burst (see FuseFx.tsx).
import gsap from 'gsap'
import type { FuseRefs } from './FuseFx'

/** Reset Fusion effects to their pre-merge resting positions before the timeline plays. */
export function resetFuseFx(refs: FuseRefs | undefined, reducedMotion: boolean): void {
  if (!refs) return
  for (const [el, dir] of [
    [refs.left, -1],
    [refs.right, 1],
  ] as const) {
    if (el) {
      gsap.set(el, {
        xPercent: dir * (reducedMotion ? 60 : 150),
        opacity: 0,
        rotation: 0,
        scale: 1,
      })
    }
  }
  if (refs.flash) {
    gsap.set(refs.flash, { opacity: 0 })
  }
  if (refs.shock) {
    gsap.set(refs.shock, { opacity: 0, scale: 0.3 })
  }
}

/** Animate the two mini source cards appearing beside the card and rushing together into the centre. */
export function addFuseMerge(
  tl: gsap.core.Timeline,
  refs: FuseRefs | undefined,
  opts: {
    start: number
    end: number
    reducedMotion: boolean
  },
): void {
  if (!refs) return
  const { start, end, reducedMotion } = opts
  const total = end - start
  if (total <= 0) return

  const minis = [
    [refs.left, -1],
    [refs.right, 1],
  ] as const

  if (reducedMotion) {
    const fadeDur = total < 0.5 ? 0.3 * (total / 0.5) : 0.3
    for (const [el] of minis) {
      if (el) {
        tl.to(el, { opacity: 1, duration: fadeDur, ease: 'none' }, start)
      }
    }
    return
  }

  // Compress entry and rush proportionally when hesitation is too short for the 0.3s + 0.35s split.
  const baseSplit = 0.65
  const compressed = total < 0.5 || total < baseSplit
  const enterDur = compressed ? total * (0.3 / baseSplit) : 0.3
  const rushDur = compressed ? total * (0.35 / baseSplit) : 0.35
  const driftDur = Math.max(0, total - enterDur - rushDur)
  const driftStart = start + enterDur
  const rushStart = end - rushDur

  for (const [el, dir] of minis) {
    if (!el) continue
    tl.to(
      el,
      {
        opacity: 1,
        xPercent: dir * 120,
        rotation: dir * 8,
        duration: enterDur,
        ease: 'power2.out',
      },
      start,
    )
    if (driftDur > 0) {
      tl.to(
        el,
        {
          xPercent: dir * 105,
          duration: driftDur,
          ease: 'none',
        },
        driftStart,
      )
    }
    tl.to(
      el,
      {
        xPercent: 0,
        rotation: 0,
        scale: 0.92,
        duration: rushDur,
        ease: 'power3.in',
      },
      rushStart,
    )
  }
}

/** Trigger the mini vanish, radial flash, and expanding shockwave ring when the source cards collide. */
export function addFuseBurst(
  tl: gsap.core.Timeline,
  refs: FuseRefs | undefined,
  opts: {
    at: number
    reducedMotion: boolean
  },
): void {
  if (!refs) return
  const { at, reducedMotion } = opts
  const minis = [refs.left, refs.right].filter((el): el is HTMLDivElement => el !== null)

  if (reducedMotion) {
    if (minis.length > 0) {
      tl.to(minis, { opacity: 0, duration: 0.4, ease: 'none' }, at)
    }
    if (refs.flash) {
      tl.fromTo(
        refs.flash,
        { opacity: 0.5 },
        { opacity: 0, duration: 0.4, ease: 'none', immediateRender: false },
        at,
      )
    }
    return
  }

  if (minis.length > 0) {
    tl.to(minis, { opacity: 0, scale: 1.15, duration: 0.12, ease: 'power2.out' }, at)
  }
  if (refs.flash) {
    tl.to(refs.flash, { opacity: 1, duration: 0.08, ease: 'power2.out' }, at)
    tl.to(refs.flash, { opacity: 0, duration: 0.5, ease: 'power2.out' }, at + 0.08)
  }
  if (refs.shock) {
    tl.fromTo(
      refs.shock,
      { scale: 0.3, opacity: 1 },
      { scale: 2.4, opacity: 0, duration: 0.65, ease: 'power2.out', immediateRender: false },
      at,
    )
  }
}
