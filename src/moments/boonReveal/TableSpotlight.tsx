import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import gsap from 'gsap'
import { combination } from '../../rules/boons'
import { BoonIcon } from '../../ui/BoonIcon'
import { playSound, stopAllSounds } from '../audio'
import type { MomentPlayerProps } from '../moduleTypes'
import { accentById, THEME, tierById, type RevealTier } from '../theme'
import { CardBackPattern, HoodedSilhouette, MazeSigil } from './BoonRevealPlayer'
import { EyeLids, type EyeRefs } from './EyeLids'
import { addEyeOpen, resetEye } from './eyeOpen'
import { EvolveFx, type EvolveRefs } from './EvolveFx'
import { addEvolveBurst, addEvolveCharge, resetEvolveFx } from './evolveTimeline'
import { FuseFx, type FuseRefs } from './FuseFx'
import { addFuseBurst, addFuseMerge, resetFuseFx } from './fuseTimeline'
import { AtomOrbit, ElectricArcs } from './LingerEffects'
import { MazeGlow } from './MazeGlow'
import { addMazeTrace, resetMaze } from './mazeTrace'
import { type BoonRevealPayload, cardText, spotlightCards } from './payload'

interface SpotlightRefs {
  slot: HTMLDivElement | null
  cardBox: HTMLDivElement | null
  flipper: HTMLDivElement | null
  back: HTMLDivElement | null
  front: HTMLDivElement | null
  veil: HTMLDivElement | null
  glow: HTMLDivElement | null
  atom: SVGSVGElement | null
  arcs: SVGSVGElement | null
  maze: SVGSVGElement | null
  rays: HTMLDivElement | null
  silhouette: HTMLDivElement | null
  sigil: SVGSVGElement | null
  newLevel: HTMLSpanElement | null
  condition: HTMLParagraphElement | null
  eye: EyeRefs
  evolve: EvolveRefs
  fuse: FuseRefs
}

function firePreset(
  instance: ReturnType<typeof confetti.create> | null,
  presetName: string,
  targetEl: HTMLElement | null,
): void {
  if (!instance || !Object.hasOwn(THEME.particlePresets, presetName)) return
  const preset = THEME.particlePresets[presetName]!
  const vw = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 720
  const scale =
    vw <= THEME.playback.smallScreenMaxWidth ? THEME.playback.smallScreenParticleScale : 1
  const rect = targetEl?.getBoundingClientRect()
  const originX = rect ? Math.min(1, Math.max(0, (rect.left + rect.width / 2) / vw)) : 0.5
  const originY = rect ? Math.min(1, Math.max(0, (rect.top + rect.height / 2) / vh)) : 0.5

  void instance({
    particleCount: Math.max(1, Math.round(preset.count * scale)),
    spread: preset.spread,
    startVelocity: preset.startVelocity,
    gravity: preset.gravity,
    drift: preset.drift,
    decay: preset.decay,
    ticks: preset.ticks,
    scalar: preset.scalar,
    shapes: preset.shapes as confetti.Shape[],
    colors: preset.colors,
    origin: { x: originX, y: originY },
    disableForReducedMotion: true,
  })
}

function partyTierFor(payload: BoonRevealPayload): RevealTier | null {
  for (const cards of Object.values(payload.offers)) {
    if (cards.length > 0) {
      const found = THEME.tiers.find((t) => t.id === cards[0]!.tier)
      if (found) return found
      break
    }
  }
  return THEME.tiers.find((t) => t.id === 'hidden') ?? null
}

function partyRecipientNames(payload: BoonRevealPayload): string {
  const withCards = Object.entries(payload.offers).filter(([, cards]) => cards.length > 0)
  const ids = withCards.length > 0 ? withCards.map(([id]) => id) : Object.keys(payload.offers)
  const names = ids.map((id) => payload.names[id] || 'A player')
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Full-screen shared table animation spotlighting significant boon cards or a party-wide hidden reveal. */
export function TableSpotlight({
  moment,
  skipped,
  reducedMotion,
  onDone,
}: MomentPlayerProps<BoonRevealPayload>) {
  const isPartyWide = moment.payload.partyWide
  const spotlights = useMemo(() => spotlightCards(moment.payload), [moment.payload])
  const hasContent = isPartyWide || spotlights.length > 0

  const rootRef = useRef<HTMLDivElement | null>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const confettiRef = useRef<ReturnType<typeof confetti.create> | null>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)

  const partyGroupRef = useRef<HTMLDivElement | null>(null)
  const partyGlowRef = useRef<HTMLDivElement | null>(null)
  const spotlightRefs = useRef<SpotlightRefs[]>([])

  const onDoneRef = useRef(onDone)
  const skippedRef = useRef(skipped)
  const payloadRef = useRef(moment.payload)
  const spotlightsRef = useRef(spotlights)
  const doneCalledRef = useRef(false)

  useEffect(() => {
    onDoneRef.current = onDone
    skippedRef.current = skipped
  })

  useLayoutEffect(() => {
    payloadRef.current = moment.payload
    spotlightsRef.current = spotlights
  })

  const finishOnce = useCallback(() => {
    if (doneCalledRef.current) return
    doneCalledRef.current = true
    onDoneRef.current()
  }, [])

  const [revealedIndices, setRevealedIndices] = useState<number[]>([])
  const [announcedIndex, setAnnouncedIndex] = useState<number | null>(null)
  const [partyRevealed, setPartyRevealed] = useState(false)

  const ensureSpotlightRef = (index: number): SpotlightRefs => {
    if (!spotlightRefs.current[index]) {
      spotlightRefs.current[index] = {
        slot: null,
        cardBox: null,
        flipper: null,
        back: null,
        front: null,
        veil: null,
        glow: null,
        atom: null,
        arcs: null,
        maze: null,
        rays: null,
        silhouette: null,
        sigil: null,
        newLevel: null,
        condition: null,
        eye: { lidTop: null, lidBottom: null, slit: null, iris: null },
        evolve: { cracks: null, flash: null, shock: null },
        fuse: { left: null, right: null, flash: null, shock: null },
      }
    }
    return spotlightRefs.current[index]!
  }

  // Nothing to show: finish immediately without rendering UI.
  useEffect(() => {
    if (!hasContent) {
      finishOnce()
    }
  }, [hasContent, finishOnce])

  // Manage the single canvas-confetti instance for the overlay lifetime.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasContent) return
    const instance = confetti.create(canvas, {
      resize: true,
      useWorker: false,
      disableForReducedMotion: true,
    })
    confettiRef.current = instance
    return () => {
      instance.reset()
      if (confettiRef.current === instance) {
        confettiRef.current = null
      }
    }
  }, [hasContent])

  // Immediate skip handler at any point in the sequence.
  useEffect(() => {
    if (!skipped) return
    timelineRef.current?.kill()
    timelineRef.current = null
    stopAllSounds()
    confettiRef.current?.reset()
    finishOnce()
  }, [skipped, finishOnce])

  useLayoutEffect(() => {
    if (!hasContent) return
    if (skippedRef.current) {
      stopAllSounds()
      finishOnce()
      return
    }

    const activePayload = payloadRef.current
    const activeSpotlights = spotlightsRef.current
    const { backdropFadeMs, flipMs, spotlightHoldMs, fadeOutMs } = THEME.timings
    const backdropFadeSec = backdropFadeMs / 1000
    const flipSec = flipMs / 1000
    const holdSec = spotlightHoldMs / 1000
    const fadeOutSec = fadeOutMs / 1000

    const ctx = gsap.context(() => {
      const rootEl = rootRef.current
      const backdropEl = backdropRef.current
      const stageEl = stageRef.current
      if (!rootEl || !backdropEl || !stageEl) return

      gsap.set(rootEl, { opacity: 1 })
      gsap.set(backdropEl, { opacity: 0 })
      gsap.set(stageEl, { x: 0, y: 0 })

      const tl = gsap.timeline({
        onComplete: () => {
          timelineRef.current = null
          finishOnce()
        },
      })
      timelineRef.current = tl

      // 1. Dim backdrop.
      tl.call(() => playSound('dim'), undefined, 0)
      tl.to(backdropEl, { opacity: 1, duration: backdropFadeSec, ease: 'power1.out' }, 0)

      if (activePayload.partyWide) {
        const hiddenTier = partyTierFor(activePayload)
        const hesSec = (hiddenTier ? hiddenTier.hesitationMs : 0) / 1000
        const revealAt = backdropFadeSec + hesSec

        if (partyGroupRef.current) {
          gsap.set(partyGroupRef.current, {
            opacity: 0,
            scale: reducedMotion ? 1 : 0.88,
          })
        }
        if (partyGlowRef.current) {
          gsap.set(partyGlowRef.current, { opacity: 0 })
        }

        tl.call(
          () => {
            setPartyRevealed(true)
            playSound('conditionMet')
            if (!reducedMotion && hiddenTier) {
              firePreset(confettiRef.current, hiddenTier.particlePreset, partyGroupRef.current)
            }
          },
          undefined,
          revealAt,
        )

        if (partyGroupRef.current) {
          tl.to(
            partyGroupRef.current,
            {
              opacity: 1,
              scale: 1,
              duration: flipSec,
              ease: reducedMotion ? 'none' : 'power2.out',
            },
            revealAt,
          )
        }
        if (partyGlowRef.current && hiddenTier) {
          tl.to(
            partyGlowRef.current,
            {
              opacity: hiddenTier.glowIntensity,
              duration: flipSec,
              ease: 'power1.out',
            },
            revealAt,
          )
        }

        const fadeAt = revealAt + flipSec + holdSec
        tl.to(rootEl, { opacity: 0, duration: fadeOutSec, ease: 'power1.in' }, fadeAt)
        return
      }

      // 2. Initialize all spotlight cards before building the sequential timeline.
      for (let i = 0; i < activeSpotlights.length; i++) {
        const refs = spotlightRefs.current[i]
        if (!refs) continue
        if (refs.slot) {
          gsap.set(refs.slot, {
            opacity: 0,
            y: reducedMotion ? 0 : 18,
            scale: reducedMotion ? 1 : 0.96,
          })
        }
        if (refs.flipper) gsap.set(refs.flipper, { scaleX: 1, x: 0, rotation: 0 })
        if (refs.back) gsap.set(refs.back, { opacity: 1 })
        if (refs.front) gsap.set(refs.front, { opacity: 0 })
        if (refs.veil) gsap.set(refs.veil, { opacity: 0.45 })
        if (refs.glow) gsap.set(refs.glow, { opacity: 0, scale: 1 })
        if (refs.atom) gsap.set(refs.atom, { opacity: 0 })
        if (refs.arcs) gsap.set(refs.arcs, { opacity: 0 })
        resetMaze(refs.maze)
        if (refs.rays) gsap.set(refs.rays, { opacity: 0, scale: 0.8, rotation: 0 })
        if (refs.silhouette) gsap.set(refs.silhouette, { opacity: 0, scale: 0.9, x: 8, y: -8 })
        if (refs.sigil) gsap.set(refs.sigil, { opacity: 0 })
        if (refs.newLevel) {
          gsap.set(refs.newLevel, { scale: reducedMotion ? 1 : 0.6, display: 'inline-block' })
        }
        if (refs.condition) {
          gsap.set(refs.condition, { opacity: 0 })
        }
        if (activeSpotlights[i]!.card.cardKind === 'hidden') {
          resetEye(refs.eye, reducedMotion)
        }
        if (activeSpotlights[i]!.card.tier === 'evolved') {
          resetEvolveFx(refs.evolve)
        }
        if (activeSpotlights[i]!.card.cardKind === 'combination') {
          resetFuseFx(refs.fuse, reducedMotion)
        }
      }

      // 3. Spotlight each significant card one at a time.
      let cursor = backdropFadeSec

      for (let i = 0; i < activeSpotlights.length; i++) {
        const { card } = activeSpotlights[i]!
        const refs = spotlightRefs.current[i]
        const prevRefs = i > 0 ? spotlightRefs.current[i - 1] : null
        const tier = tierById(card.tier)
        const accent = card.accent ? accentById(card.accent) : null
        const hesSec = tier.hesitationMs / 1000
        const flipStart = cursor + hesSec

        if (hesSec > 0) {
          const transitionSec = Math.min(0.25, Math.max(0.08, hesSec * 0.45))
          if (prevRefs?.slot) {
            tl.to(
              prevRefs.slot,
              {
                opacity: 0,
                duration: transitionSec,
                ease: reducedMotion ? 'none' : 'power1.in',
              },
              cursor,
            )
          }
          if (refs?.slot) {
            tl.to(
              refs.slot,
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: transitionSec,
                ease: reducedMotion ? 'none' : 'power2.out',
              },
              cursor,
            )
          }
        } else {
          if (prevRefs?.slot) tl.set(prevRefs.slot, { opacity: 0 }, cursor)
          if (refs?.slot) tl.set(refs.slot, { opacity: 1, y: 0, scale: 1 }, cursor)
        }

        // Hidden veil shimmer during hesitation.
        if (!reducedMotion && card.cardKind === 'hidden' && refs?.veil && hesSec > 0.1) {
          const shimmerDur = Math.min(0.35, hesSec * 0.45)
          tl.to(
            refs.veil,
            { opacity: 0.85, duration: shimmerDur, yoyo: true, repeat: 1, ease: 'sine.inOut' },
            cursor,
          )
        }

        // Evolved charge-up: ramping tremble, swelling glow, and energy cracks.
        if (card.tier === 'evolved') {
          const trembleStart = cursor + Math.min(0.12, hesSec * 0.15)
          const chargeDur = flipStart - trembleStart
          if (!reducedMotion && refs?.flipper && hesSec > 0.08) {
            const stepSec = 0.05
            const steps = Math.max(2, Math.floor((chargeDur - 0.04) / stepSec))
            for (let s = 0; s < steps; s++) {
              const dir = s % 2 === 0 ? 1 : -1
              const progress = steps > 1 ? s / (steps - 1) : 1
              const ampX = 1 + progress * 4
              const ampRot = 0.4 + progress * 1.6
              tl.to(
                refs.flipper,
                {
                  x: dir * ampX,
                  rotation: dir * ampRot,
                  duration: stepSec,
                  ease: 'none',
                },
                trembleStart + s * stepSec,
              )
            }
            tl.to(
              refs.flipper,
              { x: 0, rotation: 0, duration: 0.04, ease: 'power1.out' },
              flipStart - 0.04,
            )
          }
          if (refs?.glow && chargeDur > 0) {
            tl.to(
              refs.glow,
              reducedMotion
                ? { opacity: 0.55, duration: chargeDur, ease: 'none' }
                : { opacity: 0.55, scale: 1.12, duration: chargeDur, ease: 'power2.in' },
              trembleStart,
            )
          }
          addEvolveCharge(tl, refs?.evolve, {
            start: trembleStart,
            end: flipStart,
            reducedMotion,
          })
        }

        // Fusion source cards appear beside the card and rush together before the burst.
        if (card.cardKind === 'combination') {
          const mergeStart = cursor + Math.min(0.25, hesSec * 0.2)
          addFuseMerge(tl, refs?.fuse, {
            start: mergeStart,
            end: flipStart,
            reducedMotion,
          })
        }

        // Trigger sounds, accessible announcement, and particles at the flip moment.
        tl.call(
          () => {
            setRevealedIndices((prev) => (prev.includes(i) ? prev : [...prev, i]))
            setAnnouncedIndex(i)
            playSound(tier.soundKey)
            if (accent) {
              playSound(accent.soundKey)
            }
            if (!reducedMotion) {
              firePreset(confettiRef.current, tier.particlePreset, refs?.cardBox ?? null)
              if (accent) {
                firePreset(confettiRef.current, accent.particlePreset, refs?.cardBox ?? null)
              }
            }
          },
          undefined,
          flipStart,
        )

        if (card.cardKind === 'hidden') {
          if (refs?.back) tl.set(refs.back, { opacity: 0 }, flipStart)
          if (refs?.front) tl.set(refs.front, { opacity: 1 }, flipStart)
          addEyeOpen(tl, refs?.eye, {
            hesitationStart: cursor,
            openStart: flipStart,
            openSec: flipSec + Math.min(holdSec, 0.6),
            reducedMotion,
          })
        } else if (card.cardKind === 'combination') {
          if (refs?.back) tl.set(refs.back, { opacity: 0 }, flipStart + 0.08)
          if (refs?.front) tl.set(refs.front, { opacity: 1 }, flipStart + 0.08)
          addFuseBurst(tl, refs?.fuse, { at: flipStart, reducedMotion })
        } else if (reducedMotion) {
          if (refs?.back) {
            tl.to(refs.back, { opacity: 0, duration: flipSec, ease: 'none' }, flipStart)
          }
          if (refs?.front) {
            tl.to(refs.front, { opacity: 1, duration: flipSec, ease: 'none' }, flipStart)
          }
        } else {
          const halfFlip = flipSec * 0.45
          const openFlip = flipSec * 0.55
          const swapAt = flipStart + halfFlip

          if (refs?.flipper) {
            tl.to(refs.flipper, { scaleX: 0, duration: halfFlip, ease: 'power2.in' }, flipStart)
            tl.to(
              refs.flipper,
              { scaleX: 1, duration: openFlip, ease: 'back.out(1.4)' },
              swapAt,
            )
          }
          if (refs?.back) tl.set(refs.back, { opacity: 0 }, swapAt)
          if (refs?.front) tl.set(refs.front, { opacity: 1 }, swapAt)

          if (card.tier === 'evolved') {
            if (refs?.rays) {
              tl.to(
                refs.rays,
                { opacity: 0.55, scale: 1.05, duration: flipSec, ease: 'power2.out' },
                flipStart,
              )
              tl.to(
                refs.rays,
                { rotation: 45, duration: flipSec + holdSec, ease: 'none' },
                flipStart,
              )
            }
            if (refs?.silhouette) {
              tl.to(
                refs.silhouette,
                { opacity: 0.3, scale: 1.16, duration: flipSec, ease: 'power2.out' },
                swapAt,
              )
            }
          }

          if (tier.shake) {
            const offsets =
              card.tier === 'evolved'
                ? [
                    { x: -8, y: 4 },
                    { x: 8, y: -6 },
                    { x: -6, y: 3 },
                    { x: 5, y: -3 },
                    { x: -3, y: 2 },
                    { x: 2, y: -1 },
                    { x: -1, y: 1 },
                    { x: 0, y: 0 },
                  ]
                : [
                    { x: -5, y: 3 },
                    { x: 5, y: -3 },
                    { x: -3, y: 2 },
                    { x: 2, y: -1 },
                    { x: 0, y: 0 },
                  ]
            offsets.forEach((offset, stepIdx) => {
              tl.to(
                stageEl,
                { x: offset.x, y: offset.y, duration: 0.055, ease: 'none' },
                swapAt + stepIdx * 0.055,
              )
            })
          }

          if (refs?.newLevel && card.fromLevel !== null && card.toLevel !== null) {
            tl.to(
              refs.newLevel,
              { scale: 1, duration: 0.25, ease: 'back.out(2)' },
              swapAt,
            )
          }
        }

        if (card.tier === 'evolved') {
          addEvolveBurst(tl, refs?.evolve, { at: flipStart, reducedMotion })
        }

        if (refs?.glow) {
          tl.to(
            refs.glow,
            {
              opacity: tier.glowIntensity,
              ...(card.tier === 'evolved' && !reducedMotion ? { scale: 1 } : {}),
              duration: flipSec,
              ease: 'power1.out',
            },
            flipStart,
          )
        }
        if (refs?.atom && tier.lingerEffect === 'atom') {
          const atomAt =
            reducedMotion || card.cardKind === 'hidden' ? flipStart : flipStart + flipSec * 0.45
          tl.to(
            refs.atom,
            { opacity: 1, duration: 0.6, ease: reducedMotion ? 'none' : 'power1.out' },
            atomAt,
          )
        }
        if (refs?.arcs && tier.lingerEffect === 'electric') {
          tl.to(
            refs.arcs,
            { opacity: 1, duration: 0.5, ease: reducedMotion ? 'none' : 'power1.out' },
            flipStart + 0.15,
          )
        }
        if (refs?.sigil && accent && accent.overlay === 'sigil') {
          tl.to(
            refs.sigil,
            { opacity: 0.35, duration: flipSec * 0.8, ease: 'power1.out' },
            flipStart + flipSec * 0.2,
          )
        }
        if (accent?.glowPattern === 'maze') {
          addMazeTrace(tl, refs?.maze ?? null, {
            start: flipStart,
            traceSec: flipSec + Math.min(holdSec, 0.6),
            restOpacity: accent.glowPatternOpacity ?? 0.5,
            reducedMotion,
          })
        }
        if (refs?.condition && card.cardKind === 'hidden') {
          tl.to(
            refs.condition,
            { opacity: 1, duration: 0.25, ease: 'power1.out' },
            flipStart + flipSec * 0.5,
          )
        }

        cursor = flipStart + flipSec + holdSec
      }

      // 4. Fade out the entire overlay after the final spotlight hold.
      tl.to(rootEl, { opacity: 0, duration: fadeOutSec, ease: 'power1.in' }, cursor)
    }, rootRef)

    return () => {
      timelineRef.current = null
      ctx.revert()
      confettiRef.current?.reset()
    }
  }, [moment.id, isPartyWide, spotlights.length, hasContent, reducedMotion, finishOnce])

  if (!hasContent) {
    return null
  }

  const partyTier = isPartyWide ? partyTierFor(moment.payload) : null
  const partyRecipients = isPartyWide ? partyRecipientNames(moment.payload) : ''

  const liveAnnouncement = (() => {
    if (isPartyWide) {
      if (!partyRevealed) return ''
      return moment.payload.conditionText
        ? `Secret condition met. ${moment.payload.conditionText}`
        : 'Secret condition met'
    }
    if (announcedIndex === null) return ''
    const spotlight = spotlights[announcedIndex]
    if (!spotlight) return ''
    const text = cardText(spotlight.card)
    return `${spotlight.name}: ${text.name}, ${text.label}`
  })()

  return (
    <div
      ref={rootRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden"
    >
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/95"
      />

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      />

      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>

      <div
        ref={stageRef}
        className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center px-6 py-8"
      >
        {isPartyWide ? (
          <div
            ref={partyGroupRef}
            className="relative flex flex-col items-center justify-center px-8 py-10 text-center"
          >
            {partyTier && (
              <div
                ref={partyGlowRef}
                aria-hidden="true"
                style={{
                  // Fade to nothing at the box edges, so the glow has no visible rectangle.
                  background: `radial-gradient(ellipse closest-side, ${partyTier.color} 0%, transparent 100%)`,
                }}
                className="pointer-events-none absolute -inset-12 rounded-full"
              />
            )}
            <h2 className="relative z-10 m-0 text-4xl font-semibold tracking-wide text-stone-100 sm:text-5xl">
              Secret condition met
            </h2>
            {moment.payload.conditionText && (
              <p className="relative z-10 mt-4 mb-0 max-w-2xl text-lg text-slate-300 sm:text-xl">
                {moment.payload.conditionText}
              </p>
            )}
            {partyRecipients && (
              <p className="relative z-10 mt-3 mb-0 text-base text-stone-400 sm:text-lg">
                Hidden offers for {partyRecipients}
              </p>
            )}
          </div>
        ) : (
          <div className="grid w-full place-items-center">
            {spotlights.map((spotlight, index) => {
              const { card } = spotlight
              const tier = tierById(card.tier)
              const accent = card.accent ? accentById(card.accent) : null
              const text = cardText(card)
              const isRevealed = revealedIndices.includes(index)
              const isEvolved = card.tier === 'evolved'
              const isHidden = card.cardKind === 'hidden'
              const isFused = card.cardKind === 'combination'
              const sourceIds = isFused ? (card.sources ?? combination(card.id).boons) : null
              const detailText =
                text.detail ?? (isHidden ? moment.payload.conditionText : null)

              return (
                <div
                  key={`${spotlight.characterId}-${card.cardKind}-${card.id}-${index}`}
                  ref={(el) => {
                    ensureSpotlightRef(index).slot = el
                  }}
                  className="col-start-1 row-start-1 flex w-full flex-col items-center justify-center"
                >
                  <header className="mb-6 text-center">
                    <h2 className="m-0 text-3xl font-semibold tracking-wide text-stone-100 sm:text-4xl">
                      {spotlight.name}
                    </h2>
                    {/* The tier stays hidden until the card flips, so it doesn't spoil the reveal. */}
                    <p
                      style={{
                        color: tier.color,
                        opacity: isRevealed ? 1 : 0,
                        transition: `opacity ${THEME.timings.flipMs}ms ease`,
                      }}
                      className="mt-1.5 mb-0 text-sm font-semibold uppercase tracking-widest sm:text-base"
                    >
                      {tier.label}
                    </p>
                  </header>

                  <div
                    ref={(el) => {
                      ensureSpotlightRef(index).cardBox = el
                    }}
                    aria-label={
                      isRevealed ? `${spotlight.name}: ${text.name}, ${text.label}` : 'Face-down boon card'
                    }
                    className="relative aspect-[3/4] w-[min(36vw,320px)]"
                  >
                    {/* Tier radial glow layer */}
                    <div
                      ref={(el) => {
                        ensureSpotlightRef(index).glow = el
                      }}
                      aria-hidden="true"
                      style={{
                        background: `radial-gradient(circle, ${tier.color} 0%, transparent 72%)`,
                      }}
                      className="pointer-events-none absolute -inset-6 rounded-3xl"
                    />

                    {/* Lingering atomic orbit layer behind the card */}
                    {tier.lingerEffect === 'atom' && (
                      <AtomOrbit
                        color={tier.color}
                        still={reducedMotion}
                        className="pointer-events-none absolute -inset-24"
                        svgRef={(el) => {
                          ensureSpotlightRef(index).atom = el
                        }}
                      />
                    )}

                    {/* Accent maze glow layer */}
                    {accent?.glowPattern === 'maze' && (
                      <MazeGlow
                        color={accent.color}
                        className="pointer-events-none absolute -inset-10"
                        svgRef={(el) => {
                          ensureSpotlightRef(index).maze = el
                        }}
                      />
                    )}

                    {/* Evolved light rays layer */}
                    {isEvolved && !reducedMotion && (
                      <div
                        ref={(el) => {
                          ensureSpotlightRef(index).rays = el
                        }}
                        aria-hidden="true"
                        style={{
                          background: `repeating-conic-gradient(from 0deg, ${tier.color}44 0deg 10deg, transparent 10deg 30deg)`,
                          maskImage: 'radial-gradient(circle, black 28%, transparent 72%)',
                          WebkitMaskImage: 'radial-gradient(circle, black 28%, transparent 72%)',
                        }}
                        className="pointer-events-none absolute -inset-12 rounded-full"
                      />
                    )}

                    {/* Evolved ghostly strider silhouette behind card */}
                    {isEvolved && !reducedMotion && (
                      <div
                        ref={(el) => {
                          ensureSpotlightRef(index).silhouette = el
                        }}
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-5 flex items-center justify-center"
                      >
                        <HoodedSilhouette color={tier.color} />
                      </div>
                    )}

                    {/* Flipping card container */}
                    <div
                      ref={(el) => {
                        ensureSpotlightRef(index).flipper = el
                      }}
                      className="relative h-full w-full"
                    >
                      {/* Face-down card back */}
                      <div
                        ref={(el) => {
                          ensureSpotlightRef(index).back = el
                        }}
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl border border-stone-700/80 bg-gradient-to-b from-stone-900 to-stone-950"
                      >
                        <CardBackPattern />
                        {isHidden && (
                          <div
                            ref={(el) => {
                              ensureSpotlightRef(index).veil = el
                            }}
                            style={{
                              background: `linear-gradient(135deg, ${tier.color}2a 0%, transparent 50%, ${tier.color}33 100%)`,
                            }}
                            className="pointer-events-none absolute inset-0"
                          />
                        )}
                      </div>

                      {/* Evolved cracks, white flash, and shockwave */}
                      {isEvolved && (
                        <EvolveFx
                          color={tier.color}
                          roundedClass="rounded-2xl"
                          setRef={(key, el) => {
                            const evolve = ensureSpotlightRef(index).evolve
                            if (key === 'cracks') {
                              evolve.cracks = el as SVGSVGElement | null
                            } else {
                              evolve[key] = el as HTMLDivElement | null
                            }
                          }}
                        />
                      )}

                      {/* Face-up card front */}
                      <div
                        ref={(el) => {
                          ensureSpotlightRef(index).front = el
                        }}
                        aria-hidden={!isRevealed}
                        style={{
                          borderColor: accent ? accent.color : tier.color,
                        }}
                        className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-2xl border bg-gradient-to-b from-stone-900 via-stone-950 to-black p-4 text-center"
                      >
                        {accent && accent.overlay === 'sigil' && (
                          <MazeSigil
                            color={accent.color}
                            svgRef={(el) => {
                              ensureSpotlightRef(index).sigil = el
                            }}
                          />
                        )}

                        <div className="relative z-10 flex w-full flex-col items-center gap-2 pt-2">
                          <BoonIcon
                            art={{ kind: card.cardKind, id: card.id }}
                            name={text.name}
                            size="lg"
                          />

                          <span
                            style={{ color: tier.color }}
                            className="text-xs font-semibold uppercase tracking-wider leading-tight"
                          >
                            {card.fromLevel !== null && card.toLevel !== null ? (
                              <>
                                {tier.label} · Level {card.fromLevel} →{' '}
                                <span
                                  ref={(el) => {
                                    ensureSpotlightRef(index).newLevel = el
                                  }}
                                >
                                  {card.toLevel}
                                </span>
                              </>
                            ) : (
                              text.label
                            )}
                          </span>
                        </div>

                        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-1.5 px-2">
                          <span className="text-base font-bold leading-tight text-stone-100 sm:text-lg">
                            {text.name}
                          </span>
                          {detailText && (
                            <p
                              ref={
                                isHidden
                                  ? (el) => {
                                      ensureSpotlightRef(index).condition = el
                                    }
                                  : undefined
                              }
                              className="m-0 text-xs leading-snug text-slate-300 sm:text-sm"
                            >
                              {detailText}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Eye lids overlay for hidden boon reveal */}
                    {isHidden && (
                      <EyeLids
                        color={tier.color}
                        roundedClass="rounded-2xl"
                        setRef={(key, el) => {
                          const eye = ensureSpotlightRef(index).eye
                          if (key === 'lidTop' || key === 'lidBottom') {
                            eye[key] = el as SVGSVGElement | null
                          } else {
                            eye[key] = el as HTMLDivElement | null
                          }
                        }}
                      />
                    )}

                    {/* Lingering electric arcs on card edges */}
                    {tier.lingerEffect === 'electric' && (
                      <ElectricArcs
                        color={tier.color}
                        still={reducedMotion}
                        className="pointer-events-none absolute -inset-3"
                        svgRef={(el) => {
                          ensureSpotlightRef(index).arcs = el
                        }}
                      />
                    )}

                    {/* Fusion source cards converging, radial flash, and shockwave */}
                    {isFused && sourceIds && (
                      <FuseFx
                        color={tier.color}
                        sourceIds={sourceIds}
                        roundedClass="rounded-2xl"
                        iconSize="lg"
                        setRef={(key, el) => {
                          ensureSpotlightRef(index).fuse[key] = el as HTMLDivElement | null
                        }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
