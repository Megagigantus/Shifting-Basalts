// Portrait honors: golden glow tiers, full-clear diamonds, Field of Echoes
// full-collection badge, and full lore collection laurel. Thresholds come from src/data/portrait-honors.json.
import data from '../data/portrait-honors.json'
import { hasFullCollection, type EchoCollection, type Echoes } from './echoes'

export interface PortraitHonors {
  fullClears: number
  glowTier: number
  diamonds: number
  fullCollection: boolean
  loreLaurel: boolean
}

export const NO_HONORS: PortraitHonors = {
  fullClears: 0,
  glowTier: 0,
  diamonds: 0,
  fullCollection: false,
  loreLaurel: false,
}

export function portraitHonors(
  c: {
    fullClears?: number
    classId?: string
    secondClassId?: string
    echoes?: Echoes
    collection?: EchoCollection
    loreLaurel?: boolean
  } | null | undefined,
): PortraitHonors {
  if (!c) return NO_HONORS
  const raw = c.fullClears
  const n = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
  const glowTier = Math.min(n, data.maxGlowTier)
  const diamonds = Math.max(0, Math.min(n - data.diamondsStartAfterClears, data.maxDiamonds))
  const fullCollection = c.classId
    ? hasFullCollection({ classId: c.classId, secondClassId: c.secondClassId, echoes: c.echoes, collection: c.collection })
    : false
  const loreLaurel = c.loreLaurel === true
  return { fullClears: n, glowTier, diamonds, fullCollection, loreLaurel }
}

/** CSS classes for the portrait/token glow ring, or '' when no glow applies. */
export function honorClasses(h: PortraitHonors): string {
  if (h.glowTier <= 0 && !h.fullCollection && !h.loreLaurel) return ''
  const classes = ['honor-ring']
  if (h.glowTier > 0) classes.push(`honor-gold-${h.glowTier}`)
  if (h.fullCollection) classes.push('honor-green')
  if (h.loreLaurel) classes.push('honor-blue')
  return classes.join(' ')
}
