import themeData from '../data/moment-theme.json'

/** Presentation settings for one reveal tier. */
export interface RevealTier {
  id: string
  label: string
  color: string
  glowIntensity: number
  particlePreset: string
  soundKey: string
  hesitationMs: number
  shake: boolean
  spotlight: boolean
}

/** Conditions a tier or accent rule matches against. Empty matches everything. */
export interface RuleWhen {
  offerType?: string[]
  source?: string[]
}

/** Maps a matching offer condition to a reveal tier id. */
export interface TierRule {
  tier: string
  when: RuleWhen
}

/** Extra presentation overlay driven by a boon's source. */
export interface RevealAccent {
  id: string
  label: string
  color: string
  overlay: string
  /** Optional animated pattern traced into the reveal glow ("maze"). */
  glowPattern?: string
  /** Opacity the glow pattern settles to after tracing (0 to 1). */
  glowPatternOpacity?: number
  particlePreset: string
  soundKey: string
}

/** Maps a matching offer condition to a reveal accent id. */
export interface AccentRule {
  accent: string
  when: RuleWhen
}

/** Particle burst options passed to canvas-confetti. */
export interface ParticlePreset {
  count: number
  spread: number
  startVelocity: number
  gravity: number
  drift: number
  decay: number
  ticks: number
  scalar: number
  shapes: string[]
  colors: string[]
}

/** Sequence timing durations in milliseconds. */
export interface ThemeTimings {
  backdropFadeMs: number
  dealStaggerMs: number
  dealMs: number
  flipMs: number
  settleMs: number
  claimMs: number
  fadeOutMs: number
  /** Table display: how long each spotlighted card stays up after it flips. */
  spotlightHoldMs: number
}

/** Playback and responsive scaling thresholds. */
export interface ThemePlayback {
  maxMomentAgeMs: number
  preloadTimeoutMs: number
  smallScreenMaxWidth: number
  smallScreenParticleScale: number
}

/** Complete data-driven theme config for cinematic moments. */
export interface MomentTheme {
  id: string
  label: string
  /** Color of the face-down card pattern. */
  cardBackColor: string
  tiers: RevealTier[]
  tierRules: TierRule[]
  defaultTier: string
  accents: RevealAccent[]
  accentRules: AccentRule[]
  particlePresets: Record<string, ParticlePreset>
  sounds: Record<string, string>
  timings: ThemeTimings
  playback: ThemePlayback
}

/** Active moment theme loaded from JSON config. */
export const THEME: MomentTheme = themeData

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/** Look up a reveal tier by id, throwing if unknown. */
export function tierById(id: string, theme: MomentTheme = THEME): RevealTier {
  const found = theme.tiers.find((t) => t.id === id)
  if (!found) throw new Error(`Unknown reveal tier ${id}`)
  return found
}

/** Look up a reveal accent by id, throwing if unknown. */
export function accentById(id: string, theme: MomentTheme = THEME): RevealAccent {
  const found = theme.accents.find((a) => a.id === id)
  if (!found) throw new Error(`Unknown reveal accent ${id}`)
  return found
}

/** Significance rank of a tier (0 = least significant), throwing if unknown. */
export function tierRank(id: string, theme: MomentTheme = THEME): number {
  const index = theme.tiers.findIndex((t) => t.id === id)
  if (index < 0) throw new Error(`Unknown reveal tier ${id}`)
  return index
}

/** Validate internal consistency of a moment theme, returning human-readable problems. */
export function checkTheme(theme: MomentTheme): string[] {
  const problems: string[] = []
  const tierIds = new Set<string>()
  const accentIds = new Set<string>()

  if (!HEX_COLOR.test(theme.cardBackColor)) {
    problems.push(`cardBackColor "${theme.cardBackColor}" is not a hex color`)
  }

  for (const tier of theme.tiers) {
    if (tierIds.has(tier.id)) {
      problems.push(`Duplicate tier id "${tier.id}"`)
    }
    tierIds.add(tier.id)

    if (!HEX_COLOR.test(tier.color)) {
      problems.push(`Tier "${tier.id}" has non-hex color "${tier.color}"`)
    }
    if (!(tier.glowIntensity >= 0 && tier.glowIntensity <= 1)) {
      problems.push(`Tier "${tier.id}" glowIntensity must be between 0 and 1`)
    }
    if (!(tier.hesitationMs >= 0)) {
      problems.push(`Tier "${tier.id}" hesitationMs must not be negative`)
    }
    if (!Object.hasOwn(theme.particlePresets, tier.particlePreset)) {
      problems.push(`Tier "${tier.id}" references unknown particlePreset "${tier.particlePreset}"`)
    }
    if (!Object.hasOwn(theme.sounds, tier.soundKey)) {
      problems.push(`Tier "${tier.id}" references unknown soundKey "${tier.soundKey}"`)
    }
  }

  if (!tierIds.has(theme.defaultTier)) {
    problems.push(`defaultTier "${theme.defaultTier}" is not a known tier`)
  }

  for (const rule of theme.tierRules) {
    if (!tierIds.has(rule.tier)) {
      problems.push(`tierRules references unknown tier "${rule.tier}"`)
    }
  }

  for (const accent of theme.accents) {
    if (accentIds.has(accent.id)) {
      problems.push(`Duplicate accent id "${accent.id}"`)
    }
    accentIds.add(accent.id)

    if (!HEX_COLOR.test(accent.color)) {
      problems.push(`Accent "${accent.id}" has non-hex color "${accent.color}"`)
    }
    if (!Object.hasOwn(theme.particlePresets, accent.particlePreset)) {
      problems.push(`Accent "${accent.id}" references unknown particlePreset "${accent.particlePreset}"`)
    }
    if (!Object.hasOwn(theme.sounds, accent.soundKey)) {
      problems.push(`Accent "${accent.id}" references unknown soundKey "${accent.soundKey}"`)
    }
  }

  for (const rule of theme.accentRules) {
    if (!accentIds.has(rule.accent)) {
      problems.push(`accentRules references unknown accent "${rule.accent}"`)
    }
  }

  for (const [name, preset] of Object.entries(theme.particlePresets)) {
    for (const color of preset.colors) {
      if (!HEX_COLOR.test(color)) {
        problems.push(`ParticlePreset "${name}" has non-hex color "${color}"`)
      }
    }
  }

  for (const [key, value] of Object.entries(theme.timings)) {
    if (!(value >= 0)) {
      problems.push(`Timing "${key}" must not be negative`)
    }
  }

  return problems
}
