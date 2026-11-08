// Proficiency bonus by character level (5e): +2 at 1-4, +3 at 5-8,
// +4 at 9-12, +5 at 13-16, +6 at 17-20.
export function proficiencyBonus(level: number): number {
  const clamped = Math.min(20, Math.max(1, Math.floor(level)))
  return Math.floor((clamped - 1) / 4) + 2
}

/** The Basalts accepts characters at these levels (design bible: entry levels 5 to 20). */
export const MIN_ENTRY_LEVEL = 5
export const MAX_LEVEL = 20
