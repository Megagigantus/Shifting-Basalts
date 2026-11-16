// Recovery point pools during a run (design bible: Stat tracks, Slot recovery
// costs, Martial recovery costs, Phase 7 defaults). Every function returns a
// new state or throws.
import trackData from '../data/stat-tracks.json'
import type { Boon } from '../data/types'
import type { RunPlayer, RunState } from '../model/run'
import { boon } from './boons'
import { inFight } from './lostAndFound'
import { rankProgress } from './statTracks'

interface RecoveryTrackConfig {
  pointsLabel: string
  presets: { id: string; label: string; cost: number }[]
}

const TRACKS = Object.fromEntries(
  Object.entries(trackData.recoveryTracks).filter(([k]) => k !== '_source'),
) as Record<string, RecoveryTrackConfig>

/** Recovery track ids that have their own point pool during a run. */
export const RECOVERY_TRACKS: string[] = Object.keys(TRACKS)

function trackConfig(trackId: string): RecoveryTrackConfig {
  const cfg = TRACKS[trackId]
  if (!cfg) throw new Error(`Unknown recovery track ${trackId}.`)
  return cfg
}

/** Cost presets for a recovery track. */
export function recoveryPresets(trackId: string): { id: string; label: string; cost: number }[] {
  return trackConfig(trackId).presets
}

/** Label for a recovery track's point pool, e.g. "Slot recovery points". */
export function pointsLabel(trackId: string): string {
  return trackConfig(trackId).pointsLabel
}

/** Points per room clear on this recovery track: the character's rank in it. */
export function trackRank(p: Pick<RunPlayer, 'draftProfile'>, trackId: string): number {
  return rankProgress(p.draftProfile?.trackDevotions[trackId] ?? 0).rank
}

/** Recovery points left on this track in the current room. */
export function pointsLeft(p: Pick<RunPlayer, 'recoveryPoints'>, trackId: string): number {
  return p.recoveryPoints?.[trackId] ?? 0
}

function recoveryPayoffBoon(boonId: string): Boon & { payoffTrack: string } {
  const b = boon(boonId)
  if (b.kind !== 'payoff' || !b.payoffTrack || !(b.payoffTrack in TRACKS)) {
    throw new Error(`${b.name} is not a recovery payoff boon.`)
  }
  return b as Boon & { payoffTrack: string }
}

/** Recovery payoff boons for this track that the player holds (not suppressed). */
export function heldPayoffs(
  p: Pick<RunPlayer, 'slots'>,
  trackId: string,
): { boonId: string; name: string; level: number }[] {
  if (!(trackId in TRACKS)) return []
  const out: { boonId: string; name: string; level: number }[] = []
  for (const s of p.slots ?? []) {
    if (s?.kind !== 'boon' || s.suppressed) continue
    const b = boon(s.boonId)
    if (b.kind === 'payoff' && b.payoffTrack === trackId) {
      out.push({ boonId: b.id, name: b.name, level: s.level })
    }
  }
  return out
}

function freshPoints(p: Pick<RunPlayer, 'draftProfile'>): Record<string, number> | null {
  const pools: Record<string, number> = {}
  for (const trackId of RECOVERY_TRACKS) {
    const rank = trackRank(p, trackId)
    if (rank > 0) pools[trackId] = rank
  }
  return Object.keys(pools).length > 0 ? pools : null
}

/** A room clear that pays a Devotion: fresh points per recovery track replace any leftovers. */
export function refreshRecovery(state: RunState): RunState {
  return {
    ...state,
    players: state.players.map((p) => (inFight(p) ? { ...p, recoveryPoints: freshPoints(p) } : p)),
  }
}

/** DM correction: set a player's recovery points on one track directly. */
export function setRecoveryPoints(state: RunState, characterId: string, trackId: string, points: number): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  trackConfig(trackId)
  if (!Number.isInteger(points) || points < 0) {
    throw new Error('Recovery points must be a whole number of 0 or more.')
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.characterId === characterId ? { ...p, recoveryPoints: { ...(p.recoveryPoints ?? {}), [trackId]: points } } : p,
    ),
  }
}

function changePoints(
  state: RunState,
  characterId: string,
  change: (p: RunPlayer) => Record<string, number>,
): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.characterId !== characterId) return p
      if (!p.alive) throw new Error(`${p.name} has fallen.`)
      return { ...p, recoveryPoints: change(p) }
    }),
  }
}

/** Spend points on one of a recovery track's cost presets. */
export function recover(state: RunState, characterId: string, trackId: string, presetId: string): RunState {
  const preset = recoveryPresets(trackId).find((pr) => pr.id === presetId)
  if (!preset) throw new Error(`Unknown recovery option ${presetId}.`)
  return changePoints(state, characterId, (p) => {
    const have = pointsLeft(p, trackId)
    if (have < preset.cost) {
      throw new Error(`A ${preset.label} costs ${preset.cost} points; ${p.name} has ${have}.`)
    }
    return { ...(p.recoveryPoints ?? {}), [trackId]: have - preset.cost }
  })
}

/** Spend 1 point from a held recovery payoff boon's track pool (Leyline Surge, Momentum). */
export function spendPayoff(state: RunState, characterId: string, boonId: string): RunState {
  const b = recoveryPayoffBoon(boonId)
  return changePoints(state, characterId, (p) => {
    const held = heldPayoffs(p, b.payoffTrack).find((h) => h.boonId === b.id)
    if (!held) throw new Error(`${p.name} doesn't hold ${b.name}.`)
    const have = pointsLeft(p, b.payoffTrack)
    if (have < 1) throw new Error(`${p.name} has no ${pointsLabel(b.payoffTrack)} left.`)
    return { ...(p.recoveryPoints ?? {}), [b.payoffTrack]: have - 1 }
  })
}

/** Level 3 recovery payoff refund: add 1 point to that boon's track pool. */
export function refundPayoff(state: RunState, characterId: string, boonId: string): RunState {
  const b = recoveryPayoffBoon(boonId)
  return changePoints(state, characterId, (p) => {
    const held = heldPayoffs(p, b.payoffTrack).find((h) => h.boonId === b.id)
    if (!held || held.level < 3) throw new Error(`Refunds need ${b.name} at Level 3.`)
    const have = pointsLeft(p, b.payoffTrack)
    return { ...(p.recoveryPoints ?? {}), [b.payoffTrack]: have + 1 }
  })
}
