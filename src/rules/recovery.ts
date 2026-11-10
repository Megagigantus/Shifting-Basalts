// Spell slot recovery during a run (design bible: Stat tracks, Slot recovery
// costs, Phase 7 defaults). Every function returns a new state or throws.
import trackData from '../data/stat-tracks.json'
import type { RunPlayer, RunState } from '../model/run'
import { rankProgress } from './statTracks'

const COSTS = trackData.slotRecovery.costs as Record<string, number>
const SURGE = trackData.slotRecovery.surgeBoonId
const TRACK = 'spell-slot-recovery'

/** A player's recovery for the current room: points left, slots bought, points spent on Leyline Surge. */
export interface Recovery {
  points: number
  bought: number[]
  surged: number
}

/** Points per room clear: the Spell slot recovery rank, for casters only. */
export function recoveryRank(p: Pick<RunPlayer, 'draftProfile'>): number {
  const profile = p.draftProfile
  if (!profile || profile.casterType === 'none') return 0
  return rankProgress(profile.trackDevotions[TRACK] ?? 0).rank
}

/** Points to recover a slot of this level, or null if it can't be recovered (above 5th). */
export function recoveryCost(level: number): number | null {
  return COSTS[String(level)] ?? null
}

/** Slot levels this player can recover: ones they have, up to 5th. */
export function recoverableLevels(p: Pick<RunPlayer, 'slotLevels'>): number[] {
  return (p.slotLevels ?? []).filter((l) => recoveryCost(l) !== null).sort((a, b) => a - b)
}

/** True if the player holds Leyline Surge (not suppressed). */
export function holdsLeylineSurge(p: Pick<RunPlayer, 'slots'>): boolean {
  return (p.slots ?? []).some((s) => s?.kind === 'boon' && s.boonId === SURGE && !s.suppressed)
}

/** A room clear that pays a Devotion: fresh points replace any leftovers. */
export function grantRecovery(state: RunState): RunState {
  return {
    ...state,
    players: state.players.map((p) => {
      const rank = recoveryRank(p)
      return p.alive && rank > 0 ? { ...p, recovery: { points: rank, bought: [], surged: 0 } } : p
    }),
  }
}

function spend(state: RunState, characterId: string, change: (p: RunPlayer, r: Recovery) => Recovery): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.characterId !== characterId) return p
      if (!p.alive) throw new Error(`${p.name} has fallen.`)
      const r = p.recovery ?? { points: 0, bought: [], surged: 0 }
      return { ...p, recovery: change(p, r) }
    }),
  }
}

/** Spend points to recover one spell slot. */
export function recoverSlot(state: RunState, characterId: string, level: number): RunState {
  return spend(state, characterId, (p, r) => {
    const cost = recoveryCost(level)
    if (cost === null) throw new Error('Slots above 5th level can\'t be recovered this way.')
    if (!recoverableLevels(p).includes(level)) throw new Error(`${p.name} has no level ${level} slots.`)
    if (r.points < cost) throw new Error(`A level ${level} slot costs ${cost} points; ${p.name} has ${r.points}.`)
    return { ...r, points: r.points - cost, bought: [...r.bought, level] }
  })
}

/** Leyline Surge: spend 1 point for +1d6 force damage (d8 at Level 2) on a damaging spell. */
export function spendSurge(state: RunState, characterId: string): RunState {
  return spend(state, characterId, (p, r) => {
    if (!holdsLeylineSurge(p)) throw new Error(`${p.name} doesn't hold Leyline Surge.`)
    if (r.points < 1) throw new Error(`${p.name} has no recovery points left.`)
    return { ...r, points: r.points - 1, surged: r.surged + 1 }
  })
}
