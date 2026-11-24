import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import gsap from 'gsap'
import { combination } from '../../rules/boons'
import { BoonIcon } from '../../ui/BoonIcon'
import { playSound, stopAllSounds } from '../audio'
import type { MomentPlayerProps } from '../moduleTypes'
import { revealOrder, type RevealCard } from '../revealTier'
import { accentById, THEME, tierById } from '../theme'
import { EyeLids, type EyeRefs } from './EyeLids'
import { addEyeOpen, resetEye } from './eyeOpen'
import { EvolveFx, type EvolveRefs } from './EvolveFx'
import { addEvolveBurst, addEvolveCharge, resetEvolveFx } from './evolveTimeline'
import { FuseFx, type FuseRefs } from './FuseFx'
import { addFuseBurst, addFuseMerge, resetFuseFx } from './fuseTimeline'
import { AtomOrbit, ElectricArcs } from './LingerEffects'
import { MazeGlow } from './MazeGlow'
import { addMazeTrace, resetMaze } from './mazeTrace'
import { type BoonRevealPayload, cardsForViewer, cardText } from './payload'
import { TableSpotlight } from './TableSpotlight'

interface CardRefs {
  slot: HTMLDivElement | null
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

function headingFor(payload: BoonRevealPayload): string {
  if (payload.partyWide) return 'Secret condition met'
  if (payload.kind === 'forge') return 'The Forge'
  if (payload.kind === 'hidden') return 'A hidden offer'
  return 'Room cleared'
}

function firePreset(
  instance: ReturnType<typeof confetti.create> | null,
  presetName: string,
  cardEl: HTMLElement | null,
): void {
  if (!instance || !Object.hasOwn(THEME.particlePresets, presetName)) return
  const preset = THEME.particlePresets[presetName]!
  const vw = typeof window !== 'undefined' && window.innerWidth > 0 ? window.innerWidth : 375
  const vh = typeof window !== 'undefined' && window.innerHeight > 0 ? window.innerHeight : 667
  const scale =
    vw <= THEME.playback.smallScreenMaxWidth ? THEME.playback.smallScreenParticleScale : 1
  const rect = cardEl?.getBoundingClientRect()
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

export function HoodedSilhouette({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 120 150"
      aria-hidden="true"
      className="h-full w-full"
    >
      <path
        d="M60 8 C43 8 33 22 33 38 C33 48 38 56 44 61 C24 68 14 88 12 142 L108 142 C106 88 96 68 76 61 C82 56 87 48 87 38 C87 22 77 8 60 8 Z"
        fill={color}
      />
      <ellipse cx="60" cy="40" rx="11" ry="15" fill="#0c0a09" fillOpacity="0.55" />
    </svg>
  )
}

export function MazeSigil({
  color,
  svgRef,
}: {
  color: string
  svgRef: (el: SVGSVGElement | null) => void
}) {
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 80 80"
      aria-hidden="true"
      className="pointer-events-none absolute -top-2 -right-2 h-20 w-20"
    >
      <circle
        cx="40"
        cy="40"
        r="34"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="24 10 14 12"
      />
      <circle
        cx="40"
        cy="40"
        r="24"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="16 9 20 8"
        transform="rotate(42 40 40)"
      />
      <circle
        cx="40"
        cy="40"
        r="14"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="12 7 9 8"
        transform="rotate(-28 40 40)"
      />
    </svg>
  )
}

export function CardBackPattern() {
  return (
    <svg
      viewBox="0 0 120 160"
      aria-hidden="true"
      className="pointer-events-none h-28 w-28"
    >
      <circle
        cx="60"
        cy="80"
        r="48"
        fill="none"
        stroke={THEME.cardBackColor}
        strokeOpacity="0.14"
        strokeWidth="1"
      />
      <circle
        cx="60"
        cy="80"
        r="36"
        fill="none"
        stroke={THEME.cardBackColor}
        strokeOpacity="0.2"
        strokeWidth="1.25"
        strokeDasharray="18 8 10 8"
      />
      <circle
        cx="60"
        cy="80"
        r="24"
        fill="none"
        stroke={THEME.cardBackColor}
        strokeOpacity="0.26"
        strokeWidth="1.25"
        strokeDasharray="12 6"
      />
      <circle
        cx="60"
        cy="80"
        r="10"
        fill="none"
        stroke={THEME.cardBackColor}
        strokeOpacity="0.32"
        strokeWidth="1.5"
      />
    </svg>
  )
}

/** Full-screen boon reveal player routing table viewers to TableSpotlight and players to the phone reveal. */
export function BoonRevealPlayer(props: MomentPlayerProps<BoonRevealPayload>) {
  if (props.viewer.kind === 'table') {
    return <TableSpotlight {...props} />
  }
  return <PhoneBoonReveal {...props} />
}

function PhoneBoonReveal({
  moment,
  viewer,
  skipped,
  reducedMotion,
  onDone,
}: MomentPlayerProps<BoonRevealPayload>) {
  const hand =
    viewer.kind === 'player' ? cardsForViewer(moment.payload, viewer.characterIds) : null

  const rootRef = useRef<HTMLDivElement | null>(null)
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const confettiRef = useRef<ReturnType<typeof confetti.create> | null>(null)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const cardRefs = useRef<CardRefs[]>([])

  const onDoneRef = useRef(onDone)
  const skippedRef = useRef(skipped)
  const doneCalledRef = useRef(false)

  useEffect(() => {
    onDoneRef.current = onDone
    skippedRef.current = skipped
  })

  const finishOnce = useCallback(() => {
    if (doneCalledRef.current) return
    doneCalledRef.current = true
    onDoneRef.current()
  }, [])

  const [revealedIndices, setRevealedIndices] = useState<number[]>([])

  const cards = hand?.cards ?? []
  const handCharacterId = hand?.characterId ?? null
  const characterName = handCharacterId ? (moment.payload.names[handCharacterId] ?? '') : ''

  const cardsRef = useRef(cards)
  useLayoutEffect(() => {
    cardsRef.current = cards
  })

  const ensureCardRef = (index: number): CardRefs => {
    if (!cardRefs.current[index]) {
      cardRefs.current[index] = {
        slot: null,
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
    return cardRefs.current[index]!
  }

  // Non-players or viewers with no cards finish immediately without rendering UI.
  useEffect(() => {
    if (!handCharacterId) {
      finishOnce()
    }
  }, [handCharacterId, finishOnce])

  // Manage the single canvas-confetti instance for the overlay lifetime.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !handCharacterId) return
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
  }, [handCharacterId])

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
    const activeCards = cardsRef.current
    if (!handCharacterId || activeCards.length === 0) return
    if (skippedRef.current) {
      stopAllSounds()
      finishOnce()
      return
    }

    const { backdropFadeMs, dealStaggerMs, dealMs, flipMs, settleMs, fadeOutMs } = THEME.timings
    const backdropFadeSec = backdropFadeMs / 1000
    const dealStaggerSec = dealStaggerMs / 1000
    const dealSec = dealMs / 1000
    const flipSec = flipMs / 1000
    const settleSec = settleMs / 1000
    const fadeOutSec = fadeOutMs / 1000

    const order = revealOrder(activeCards)

    const ctx = gsap.context(() => {
      const rootEl = rootRef.current
      const backdropEl = backdropRef.current
      const stageEl = stageRef.current
      if (!rootEl || !backdropEl || !stageEl) return

      gsap.set(rootEl, { opacity: 1 })
      gsap.set(backdropEl, { opacity: 0 })
      gsap.set(stageEl, { x: 0, y: 0 })

      for (let i = 0; i < activeCards.length; i++) {
        const refs = cardRefs.current[i]
        if (!refs) continue
        if (refs.slot) {
          gsap.set(refs.slot, {
            opacity: 0,
            y: reducedMotion ? 0 : 28,
            scale: reducedMotion ? 1 : 0.92,
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
        if (refs.silhouette) gsap.set(refs.silhouette, { opacity: 0, scale: 0.9, x: 6, y: -6 })
        if (refs.sigil) gsap.set(refs.sigil, { opacity: 0 })
        if (refs.newLevel) {
          gsap.set(refs.newLevel, { scale: reducedMotion ? 1 : 0.6, display: 'inline-block' })
        }
        if (refs.condition) {
          gsap.set(refs.condition, { opacity: 0 })
        }
        if (activeCards[i]!.cardKind === 'hidden') {
          resetEye(refs.eye, reducedMotion)
        }
        if (activeCards[i]!.tier === 'evolved') {
          resetEvolveFx(refs.evolve)
        }
        if (activeCards[i]!.cardKind === 'combination') {
          resetFuseFx(refs.fuse, reducedMotion)
        }
      }

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

      // 2. Deal face-down cards staggered.
      const dealStart = backdropFadeSec
      tl.call(() => playSound('deal'), undefined, dealStart)

      for (let i = 0; i < activeCards.length; i++) {
        const refs = cardRefs.current[i]
        const at = dealStart + i * dealStaggerSec
        if (refs?.slot) {
          tl.to(
            refs.slot,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: dealSec,
              ease: reducedMotion ? 'none' : 'power2.out',
            },
            at,
          )
        }
        if (!reducedMotion && refs?.veil) {
          tl.to(
            refs.veil,
            { opacity: 0.85, duration: dealSec * 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' },
            at,
          )
        }
      }

      // 3-5. Hesitate & flip in revealOrder (least significant first).
      let cursor = dealStart + dealSec + Math.max(0, activeCards.length - 1) * dealStaggerSec

      for (const cardIndex of order) {
        const card: RevealCard = activeCards[cardIndex]!
        const refs = cardRefs.current[cardIndex]
        const tier = tierById(card.tier)
        const accent = card.accent ? accentById(card.accent) : null
        const hesSec = tier.hesitationMs / 1000
        const flipStart = cursor + hesSec

        // Evolved charge-up: ramping tremble, swelling glow, and energy cracks.
        if (card.tier === 'evolved') {
          if (!reducedMotion && refs?.flipper && hesSec > 0.08) {
            const stepSec = 0.05
            const steps = Math.max(2, Math.floor((hesSec - 0.04) / stepSec))
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
                cursor + s * stepSec,
              )
            }
            tl.to(
              refs.flipper,
              { x: 0, rotation: 0, duration: 0.04, ease: 'power1.out' },
              flipStart - 0.04,
            )
          }
          if (refs?.glow && hesSec > 0) {
            tl.to(
              refs.glow,
              reducedMotion
                ? { opacity: 0.55, duration: hesSec, ease: 'none' }
                : { opacity: 0.55, scale: 1.12, duration: hesSec, ease: 'power2.in' },
              cursor,
            )
          }
          addEvolveCharge(tl, refs?.evolve, {
            start: cursor,
            end: flipStart,
            reducedMotion,
          })
        }

        // Fusion source cards appear beside the card and rush together before the burst.
        if (card.cardKind === 'combination') {
          addFuseMerge(tl, refs?.fuse, {
            start: cursor,
            end: flipStart,
            reducedMotion,
          })
        }

        // Trigger sounds, aria reveal state, and particles at the flip moment.
        tl.call(
          () => {
            setRevealedIndices((prev) => (prev.includes(cardIndex) ? prev : [...prev, cardIndex]))
            playSound(tier.soundKey)
            if (accent) {
              playSound(accent.soundKey)
            }
            if (!reducedMotion) {
              firePreset(confettiRef.current, tier.particlePreset, refs?.slot ?? null)
              if (accent) {
                firePreset(confettiRef.current, accent.particlePreset, refs?.slot ?? null)
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
            openSec: flipSec + settleSec,
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
              tl.to(refs.rays, { opacity: 0.55, scale: 1.05, duration: flipSec, ease: 'power2.out' }, flipStart)
              tl.to(
                refs.rays,
                { rotation: 45, duration: flipSec + settleSec, ease: 'none' },
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
                    { x: -4, y: 2 },
                    { x: 4, y: -3 },
                    { x: -3, y: 1 },
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
        if (refs?.sigil && accent) {
          tl.to(
            refs.sigil,
            { opacity: 0.35, duration: flipSec * 0.8, ease: 'power1.out' },
            flipStart + flipSec * 0.2,
          )
        }
        if (accent?.glowPattern === 'maze') {
          addMazeTrace(tl, refs?.maze ?? null, {
            start: flipStart,
            traceSec: flipSec + settleSec,
            restOpacity: accent.glowPatternOpacity ?? 0.5,
            reducedMotion,
          })
        }
        if (refs?.condition && card.cardKind === 'hidden' && card.conditionText) {
          tl.to(
            refs.condition,
            { opacity: 1, duration: 0.25, ease: 'power1.out' },
            flipStart + flipSec * 0.5,
          )
        }

        cursor = flipStart + flipSec
      }

      // 6. Settle and fade out the entire overlay.
      const fadeAt = cursor + settleSec
      tl.to(rootEl, { opacity: 0, duration: fadeOutSec, ease: 'power1.in' }, fadeAt)
    }, rootRef)

    return () => {
      timelineRef.current = null
      ctx.revert()
      confettiRef.current?.reset()
    }
  }, [moment.id, reducedMotion, handCharacterId, finishOnce])

  if (!hand) {
    return null
  }

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

      <div
        ref={stageRef}
        className="relative z-10 flex w-full max-w-5xl flex-col items-center justify-center px-4 py-6"
      >
        <header className="mb-5 text-center">
          <h2 className="m-0 text-xl font-semibold tracking-wide text-stone-100 sm:text-2xl">
            {headingFor(moment.payload)}
          </h2>
          {characterName && (
            <p className="mt-1 mb-0 text-sm text-stone-400">{characterName}</p>
          )}
          {moment.payload.partyWide && moment.payload.conditionText && (
            <p className="mt-2 mb-0 max-w-md text-xs text-slate-300 sm:text-sm">
              {moment.payload.conditionText}
            </p>
          )}
        </header>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {cards.map((card, index) => {
            const tier = tierById(card.tier)
            const accent = card.accent ? accentById(card.accent) : null
            const text = cardText(card)
            const isRevealed = revealedIndices.includes(index)
            const isEvolved = card.tier === 'evolved'
            const isHidden = card.cardKind === 'hidden'
            const isFused = card.cardKind === 'combination'
            const sourceIds = isFused ? (card.sources ?? combination(card.id).boons) : null

            return (
              <div
                key={`${card.cardKind}-${card.id}-${index}`}
                ref={(el) => {
                  ensureCardRef(index).slot = el
                }}
                aria-label={isRevealed ? `${text.name}, ${text.label}` : 'Face-down boon card'}
                className="relative aspect-[3/4] w-[42vw] max-w-[180px]"
              >
                {/* Tier radial glow layer */}
                <div
                  ref={(el) => {
                    ensureCardRef(index).glow = el
                  }}
                  aria-hidden="true"
                  style={{
                    background: `radial-gradient(circle, ${tier.color} 0%, transparent 72%)`,
                  }}
                  className="pointer-events-none absolute -inset-4 rounded-2xl"
                />

                {/* Lingering atomic orbit layer behind the card */}
                {tier.lingerEffect === 'atom' && (
                  <AtomOrbit
                    color={tier.color}
                    still={reducedMotion}
                    svgRef={(el) => {
                      ensureCardRef(index).atom = el
                    }}
                  />
                )}

                {/* Accent maze glow layer */}
                {accent?.glowPattern === 'maze' && (
                  <MazeGlow
                    color={accent.color}
                    svgRef={(el) => {
                      ensureCardRef(index).maze = el
                    }}
                  />
                )}

                {/* Evolved light rays layer */}
                {isEvolved && !reducedMotion && (
                  <div
                    ref={(el) => {
                      ensureCardRef(index).rays = el
                    }}
                    aria-hidden="true"
                    style={{
                      background: `repeating-conic-gradient(from 0deg, ${tier.color}44 0deg 10deg, transparent 10deg 30deg)`,
                      maskImage: 'radial-gradient(circle, black 28%, transparent 72%)',
                      WebkitMaskImage: 'radial-gradient(circle, black 28%, transparent 72%)',
                    }}
                    className="pointer-events-none absolute -inset-8 rounded-full"
                  />
                )}

                {/* Evolved ghostly strider silhouette behind card */}
                {isEvolved && !reducedMotion && (
                  <div
                    ref={(el) => {
                      ensureCardRef(index).silhouette = el
                    }}
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-3 flex items-center justify-center"
                  >
                    <HoodedSilhouette color={tier.color} />
                  </div>
                )}

                {/* Flipping card container */}
                <div
                  ref={(el) => {
                    ensureCardRef(index).flipper = el
                  }}
                  className="relative h-full w-full"
                >
                  {/* Face-down card back */}
                  <div
                    ref={(el) => {
                      ensureCardRef(index).back = el
                    }}
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl border border-stone-700/80 bg-gradient-to-b from-stone-900 to-stone-950"
                  >
                    <CardBackPattern />
                    {isHidden && (
                      <div
                        ref={(el) => {
                          ensureCardRef(index).veil = el
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
                      setRef={(key, el) => {
                        const evolve = ensureCardRef(index).evolve
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
                      ensureCardRef(index).front = el
                    }}
                    aria-hidden={!isRevealed}
                    style={{
                      borderColor: accent ? accent.color : tier.color,
                    }}
                    className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-xl border bg-gradient-to-b from-stone-900 via-stone-950 to-black p-2 text-center"
                  >
                    {accent && accent.overlay === 'sigil' && (
                      <MazeSigil
                        color={accent.color}
                        svgRef={(el) => {
                          ensureCardRef(index).sigil = el
                        }}
                      />
                    )}

                    <div className="relative z-10 flex w-full flex-col items-center gap-1">
                      <BoonIcon art={{ kind: card.cardKind, id: card.id }} name={text.name} size="lg" />

                      <span
                        style={{ color: tier.color }}
                        className="text-[10px] font-semibold uppercase tracking-wider leading-tight"
                      >
                        {card.fromLevel !== null && card.toLevel !== null ? (
                          <>
                            {tier.label} · Level {card.fromLevel} →{' '}
                            <span
                              ref={(el) => {
                                ensureCardRef(index).newLevel = el
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

                    <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-0.5">
                      <span className="text-xs font-bold leading-tight text-stone-100">
                        {text.name}
                      </span>
                      {text.detail && (
                        <p
                          ref={
                            isHidden
                              ? (el) => {
                                  ensureCardRef(index).condition = el
                                }
                              : undefined
                          }
                          className="m-0 text-[10px] leading-tight text-slate-300"
                        >
                          {text.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Eye lids overlay for hidden boon reveal */}
                {isHidden && (
                  <EyeLids
                    color={tier.color}
                    setRef={(key, el) => {
                      const eye = ensureCardRef(index).eye
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
                    svgRef={(el) => {
                      ensureCardRef(index).arcs = el
                    }}
                  />
                )}

                {/* Fusion source cards converging, radial flash, and shockwave */}
                {isFused && sourceIds && (
                  <FuseFx
                    color={tier.color}
                    sourceIds={sourceIds}
                    setRef={(key, el) => {
                      ensureCardRef(index).fuse[key] = el as HTMLDivElement | null
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
