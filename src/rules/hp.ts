// HP tracking for the current room's enemies and boss (DM only). The room
// stores damage taken per tracker; max HP comes from the stats (creatureStats
// for roster creatures, buildBoss for bosses). Bloodied = at half max HP or
// fewer (2024 rules). A boss is Bloodied when its whole pool is: the shared
// pool, or all its parts added together. The DM can override the boss's
// Bloodied state by hand.
import { creatureOf, creatureStats } from './encounters'
import { buildBoss } from './bosses'
import type { Room } from './rooms'

export interface HpState {
  /** Damage taken, by tracker key. Missing = unhurt. */
  damage: Record<string, number>
  /** The DM's Bloodied button for the boss: true/false, or null for automatic. */
  bossBloodied: boolean | null
}

/** What the players' view may know: Bloodied counts and flags, never numbers. */
export interface HpShown {
  /** Bloodied creatures per encounter group index (only groups with any). */
  enemyBloodied: Record<string, number>
  boss: boolean
  /** Per enemy token (tracker key): Bloodied or Down, for the battle map. Unhurt ones are left out. */
  tokens?: Record<string, 'bloodied' | 'down'>
}

export interface Tracker {
  key: string
  label: string
  max: number
  current: number
  bloodied: boolean
  down: boolean
  /** Encounter group index, for enemies. */
  group?: number
  /** Boss part name, for bosses with separate part pools. */
  part?: string
}

export interface FightContext {
  partyLevel: number
  pressures: string[]
}

export const emptyHp = (): HpState => ({ damage: {}, bossBloodied: null })

const isBloodied = (current: number, max: number) => current <= max / 2

function tracker(key: string, label: string, max: number, hp: HpState | undefined, extra: Partial<Tracker> = {}): Tracker {
  const current = Math.max(0, max - Math.min(max, hp?.damage[key] ?? 0))
  return { key, label, max, current, bloodied: isBloodied(current, max), down: current === 0, ...extra }
}

/** Every HP tracker in the room: one per creature, or the boss's pool(s). */
export function hpTrackers(room: Room, ctx: FightContext): Tracker[] {
  const hp = room.hp
  if (room.boss) {
    const boss = buildBoss(room.boss.id, ctx.partyLevel, room.boss.partySize, ctx.pressures)
    if (boss.parts.length && !boss.sharedHp) {
      return boss.parts.flatMap((p) =>
        Array.from({ length: p.count }, (_, n) =>
          tracker(`part:${p.name}:${n}`, p.count > 1 ? `${p.name} ${n + 1}` : p.name, p.hp ?? 0, hp, { part: p.name }),
        ),
      )
    }
    return [tracker('boss', boss.name, boss.hp, hp)]
  }
  if (!room.encounter) return []
  return room.encounter.groups.flatMap((g, i) => {
    const name = creatureOf(g.creatureId).name
    const max = creatureStats(g).hp
    return Array.from({ length: g.count }, (_, n) =>
      tracker(`enemy:${i}:${n}`, g.count > 1 ? `${name} ${n + 1}` : name, max, hp, { group: i }),
    )
  })
}

/** Whether the boss counts as Bloodied: the DM's override, else its whole pool at half or below. */
export function bossBloodied(room: Room, ctx: FightContext): boolean {
  if (!room.boss) return false
  if (room.hp && room.hp.bossBloodied !== null) return room.hp.bossBloodied
  const all = hpTrackers(room, ctx)
  const max = all.reduce((s, t) => s + t.max, 0)
  const current = all.reduce((s, t) => s + t.current, 0)
  return max > 0 && isBloodied(current, max)
}

/** The Bloodied facts players may see. */
export function hpShown(room: Room, ctx: FightContext): HpShown {
  const enemyBloodied: Record<string, number> = {}
  const tokens: Record<string, 'bloodied' | 'down'> = {}
  for (const t of hpTrackers(room, ctx)) {
    if (t.group !== undefined && t.bloodied) enemyBloodied[t.group] = (enemyBloodied[t.group] ?? 0) + 1
    if (t.group !== undefined && (t.down || t.bloodied)) tokens[t.key] = t.down ? 'down' : 'bloodied'
  }
  return { enemyBloodied, boss: bossBloodied(room, ctx), tokens }
}

/** Apply damage (positive) or healing (negative) to one tracker, kept between 0 and its max. */
export function applyHp(hp: HpState | undefined, key: string, max: number, amount: number): HpState {
  const base = hp ?? emptyHp()
  const damage = Math.min(max, Math.max(0, (base.damage[key] ?? 0) + Math.round(amount)))
  const rest = { ...base.damage }
  delete rest[key]
  return { ...base, damage: damage > 0 ? { ...rest, [key]: damage } : rest }
}
