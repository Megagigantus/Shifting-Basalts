import { THEME, accentById, tierById } from '../theme'
import { MazeGlow } from './MazeGlow'

/** Subtle persistent reveal-tier glow, border ring, and optional accent sigil for a draft card. */
export function TierGlow({
  tier,
  accent,
  claimed = false,
}: {
  tier: string
  accent: string | null
  claimed?: boolean
}) {
  const tierInfo = tierById(tier)
  const accentInfo = accent ? accentById(accent) : null
  const { claimMs } = THEME.timings
  const glowOpacity = claimed
    ? Math.min(1, tierInfo.glowIntensity * 0.9)
    : tierInfo.glowIntensity * 0.35

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-xl"
        style={{
          opacity: glowOpacity,
          transition: `opacity ${claimMs}ms ease`,
        }}
      >
        <div
          className="tier-glow-pulse h-full w-full rounded-xl"
          style={{
            background: `radial-gradient(120% 90% at 50% 0%, ${tierInfo.color} 0%, transparent 70%)`,
          }}
        />
      </div>
      {accentInfo?.glowPattern === 'maze' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-xl"
          style={{
            opacity: claimed
              ? (accentInfo.glowPatternOpacity ?? 0.5)
              : (accentInfo.glowPatternOpacity ?? 0.5) * 0.5,
            transition: `opacity ${claimMs}ms ease`,
          }}
        >
          <MazeGlow
            color={accentInfo.color}
            svgRef={() => {}}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        </div>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          border: `1px solid ${tierInfo.color}`,
          opacity: claimed ? 0.9 : 0.45,
          transition: `opacity ${claimMs}ms ease`,
        }}
      />
      {accentInfo && (
        <svg
          aria-hidden="true"
          viewBox="0 0 28 28"
          width={28}
          height={28}
          fill="none"
          stroke={accentInfo.color}
          strokeWidth={1.5}
          strokeLinecap="round"
          className="pointer-events-none absolute top-2.5 right-2.5"
          style={{ opacity: 0.6 }}
        >
          <circle
            cx="14"
            cy="14"
            r="11"
            strokeDasharray="24 10 25 10"
            transform="rotate(-25 14 14)"
          />
          <circle
            cx="14"
            cy="14"
            r="7.5"
            strokeDasharray="16 8 15 8"
            transform="rotate(45 14 14)"
          />
          <circle
            cx="14"
            cy="14"
            r="4"
            strokeDasharray="17 8"
            transform="rotate(135 14 14)"
          />
        </svg>
      )}
    </>
  )
}
