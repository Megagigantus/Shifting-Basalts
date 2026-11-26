// DM-only line naming the table roll that earns a lore card's push.
import type { LoreCheck } from '../lore/types'

/** "History or Investigation" style list of skills. */
function formatCheckSkills(skills: string[]): string {
  if (skills.length <= 1) return skills[0] ?? ''
  return `${skills.slice(0, -1).join(', ')} or ${skills[skills.length - 1]}`
}

export function CheckLine({ check }: { check: LoreCheck }) {
  return (
    <p className="m-0 text-xs font-semibold text-amber-300">
      Roll {formatCheckSkills(check.skills)}, DC {check.dc}
    </p>
  )
}
