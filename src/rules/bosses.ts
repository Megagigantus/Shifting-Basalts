// The boss builder (design bible: Bosses, Boss stat scaling, CR benchmarks,
// Boss templates, Encounter and boss defaults). Boss stats are original,
// built from the benchmarks; the content lives in data/bosses.json.
import bossData from '../data/bosses.json'
import type { Random } from './draft'
import { benchmark } from './encounters'

type BossTemplate = (typeof bossData.bosses)[number] & {
  parts?: { name: string; count: number; acAdjust?: number; hpMultiplier?: number; hpShare?: number }[]
  sharedHp?: boolean
  traits?: string[]
  legendaryOptions?: { name: string; text: string }[]
  phase2ExtraLegendaryActions?: number
}

export const BOSSES = bossData.bosses as BossTemplate[]
const SCALING = bossData.scaling

export const bossOf = (id: string) => BOSSES.find((b) => b.id === id)!
export const bossesOnFloor = (floor: number) => BOSSES.filter((b) => b.floor === floor)

const pick = <T,>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]

/** Pick a floor's boss when it starts (optionally not the one it had). */
export function pickBoss(floor: number, random: Random, exclude?: string | null): string {
  const all = bossesOnFloor(floor)
  const options = all.filter((b) => b.id !== exclude)
  return pick(options.length ? options : all, random).id
}

/** Restless Stone: Shift Actions from the floor's other bosses (never the floor's own boss). */
export function restlessShiftActions(floor: number, bossId: string | null, count: number, random: Random): string[] {
  const options = bossesOnFloor(floor)
    .filter((b) => b.id !== bossId)
    .map((b) => b.id)
  const out: string[] = []
  const wanted = Math.min(count, options.length)
  while (out.length < wanted) {
    out.push(options.splice(Math.floor(random() * options.length), 1)[0])
  }
  return out
}

export interface Damage {
  expression: string
  average: number
}

/**
 * Turn a damage target into dice: about 30% flat bonus, the rest dice of the
 * given size (General Vane: 23 -> 3d10 + 7). Small amounts step down to a
 * smaller die when the bigger one would miss the target by more than a quarter.
 */
export function damageDice(target: number, die = SCALING.defaultDie): Damage {
  const flat = Math.round(target * SCALING.flatShare)
  const sizes = [Number(die.slice(1)), 8, 6, 4].filter((s, i, all) => i === 0 || s < all[0])
  for (const size of sizes) {
    const avg = (size + 1) / 2
    const n = Math.round((target - flat) / avg)
    if (n >= 1 && Math.abs(n * avg + flat - target) <= Math.max(1, target * 0.25)) {
      return {
        expression: flat > 0 ? `${n}d${size} + ${flat}` : `${n}d${size}`,
        average: Math.floor(n * avg + flat),
      }
    }
  }
  const value = Math.max(1, Math.round(target))
  return { expression: String(value), average: value }
}

export interface BossAttack {
  name: string
  group?: string
  count: number
  kind: string
  save?: string
  type: string
  damage: Damage
  text: string
}

export interface BossPart {
  name: string
  count: number
  ac: number
  /** Per creature; null when the boss shares one HP pool. */
  hp: number | null
}

export interface BossStats {
  bossId: string
  name: string
  floor: number
  role: string
  cr: number
  pb: number
  ac: number
  hp: number
  attack: number
  dc: number
  dpr: number
  sharedHp: boolean
  parts: BossPart[]
  traits: string[]
  attacks: BossAttack[]
  specials: { name: string; text: string }[]
  legendaryActions: number
  legendaryResistances: number
  phase2ExtraLegendaryActions: number
  legendaryOptions: { name: string; text: string }[]
  shiftAction: { name: string; text: string }
}

/** Target CR for a floor's boss: party level + the floor's offset, at least 1. */
export function bossCr(floor: number, partyLevel: number): number {
  const row = SCALING.floors.find((f) => f.floor === floor)!
  return Math.max(1, partyLevel + row.crOffset)
}

/** The save DC Shift Actions use on a floor (the floor's boss DC). */
export function floorBossDc(floor: number, partyLevel: number): number {
  return benchmark(bossCr(Math.min(floor, 5), partyLevel)).dc
}

/** Build a boss's stat block for this party. `partySize`: living players. */
export function buildBoss(bossId: string, partyLevel: number, partySize: number, pressures: string[]): BossStats {
  const t = bossOf(bossId)
  const floorRow = SCALING.floors.find((f) => f.floor === t.floor)!
  const cr = bossCr(t.floor, partyLevel)
  const b = benchmark(cr)
  const sizeFactor = Math.max(1, partySize) / SCALING.basePartySize
  const totalHp = Math.round(b.hp * t.hpMultiplier * sizeFactor)

  const parts: BossPart[] = (t.parts ?? []).map((p) => ({
    name: p.name,
    count: p.count,
    ac: b.ac + (p.acAdjust ?? t.acAdjust),
    hp: t.sharedHp
      ? null
      : p.hpMultiplier !== undefined
        ? Math.round(b.hp * p.hpMultiplier * sizeFactor)
        : Math.round(totalHp * (p.hpShare ?? 1)),
  }))
  const hp = parts.length && !t.sharedHp ? parts.reduce((s, p) => s + (p.hp ?? 0) * p.count, 0) : totalHp

  let la = floorRow.legendaryActions
  let lr = floorRow.legendaryResistances
  if (partySize >= SCALING.bigPartySize) la += SCALING.bigPartyExtraLegendaryActions
  for (const id of pressures) {
    const extra = (SCALING.pressures as Record<string, { legendaryActions: number; legendaryResistances: number }>)[id]
    if (extra) {
      la += extra.legendaryActions
      lr += extra.legendaryResistances
    }
  }

  const fillText = (text: string) =>
    text.replace(/\{([a-z]+)(?::([\d.]+))?(?::(d\d+))?\}/g, (_, kind: string, n?: string, die?: string) => {
      const value = Number(n ?? 0)
      if (kind === 'dc') return String(b.dc)
      if (kind === 'bpb') return String(value * b.pb)
      if (kind === 'hp') return String(Math.round((hp * value) / 100))
      const d = damageDice((b.dpr * value) / 100, die ?? 'd6')
      return `${d.average} (${d.expression})`
    })

  return {
    bossId: t.id,
    name: t.name,
    floor: t.floor,
    role: t.role,
    cr,
    pb: b.pb,
    ac: b.ac + t.acAdjust,
    hp,
    attack: b.attack,
    dc: b.dc,
    dpr: b.dpr,
    sharedHp: Boolean(t.sharedHp),
    parts,
    traits: t.traits ?? [],
    attacks: t.attacks.map((a) => ({
      name: a.name,
      group: (a as { group?: string }).group,
      count: a.count,
      kind: a.kind,
      save: (a as { save?: string }).save,
      type: a.type,
      damage: damageDice((b.dpr * a.percent) / 100, (a as { die?: string }).die),
      text: fillText(a.text),
    })),
    specials: (t.specials ?? []).map((s) => ({ name: s.name, text: fillText(s.text) })),
    legendaryActions: la,
    legendaryResistances: lr,
    phase2ExtraLegendaryActions: t.phase2ExtraLegendaryActions ?? 0,
    legendaryOptions:
      la > 0
        ? (t.legendaryOptions ?? SCALING.genericLegendaryActions).map((o) => ({ name: o.name, text: fillText(o.text) }))
        : [],
    shiftAction: { name: t.shiftAction.name, text: fillText(t.shiftAction.text) },
  }
}
