// The Reclamation Shrine (design bible: Full clear rewards). Once anyone in
// the party owns it, it stands in each post-boss room on floors 1 to 4. The
// party can bring back an ally expelled on this floor by paying
// 5 × floor × entry multiplier from this run's unbanked boss Basalts,
// pledged by living players on their own devices. The ally returns with their
// boons, no lockout, and their run Basalts restored.
import type { RunPlayer, RunState } from '../model/run'
import { LAST_FLOOR } from './run'
import { reclaimCost } from './upgrades'

/** A player's pledge toward bringing back one ally: runs/{runId}/pledges/{characterId}. */
export interface Pledge {
  targetId: string
  amount: number
  /** The floor it was made on; pledges from an earlier floor don't count. */
  floor: number
}

/** True when the Shrine is in this post-boss room. Fallen owners count. */
export function shrineHere({ run, players }: RunState): boolean {
  return run.status === 'active' && run.awaitingChoice && run.floor < LAST_FLOOR && players.some((p) => p.shrineOwner)
}

/** Allies the Shrine can bring back: expelled on the current floor. */
export function reclaimable(state: RunState): RunPlayer[] {
  return state.players.filter((p) => !p.alive && p.diedOnFloor === state.run.floor)
}

/** What it costs to bring back one ally right now. */
export const shrineCost = ({ run }: RunState) => reclaimCost(run.floor, run.entryMultiplier)

/**
 * The pledges that count toward one ally, in party order: from living
 * players, made on this floor, capped at what each has earned this run.
 */
export function pledgesFor(state: RunState, pledges: Record<string, Pledge>, targetId: string): { characterId: string; name: string; amount: number }[] {
  return state.players
    .filter((p) => p.alive)
    .map((p) => ({ p, pledge: pledges[p.characterId] }))
    .filter(({ pledge }) => pledge && pledge.targetId === targetId && pledge.floor === state.run.floor && pledge.amount > 0)
    .map(({ p, pledge }) => ({ characterId: p.characterId, name: p.name, amount: Math.min(pledge.amount, p.quantumBasaltsEarned) }))
    .filter((x) => x.amount > 0)
}

/** Total that counts toward one ally. */
export const pledgedTotal = (state: RunState, pledges: Record<string, Pledge>, targetId: string) =>
  pledgesFor(state, pledges, targetId).reduce((sum, x) => sum + x.amount, 0)

/**
 * Bring an ally back. Takes pledges in party order until the cost is met (the
 * last one only in part), and returns who paid what.
 */
export function reclaim(
  state: RunState,
  targetId: string,
  pledges: Record<string, Pledge>,
): { state: RunState; paid: Record<string, number> } {
  if (!shrineHere(state)) throw new Error('There is no Reclamation Shrine here.')
  const target = reclaimable(state).find((p) => p.characterId === targetId)
  if (!target) throw new Error('Only allies expelled on this floor can be reclaimed.')
  const cost = shrineCost(state)
  const total = pledgedTotal(state, pledges, targetId)
  if (total < cost) throw new Error(`The Shrine needs ${cost} Basalts; the party has pledged ${total}.`)
  let left = cost
  const paid: Record<string, number> = {}
  for (const x of pledgesFor(state, pledges, targetId)) {
    if (left === 0) break
    const take = Math.min(x.amount, left)
    paid[x.characterId] = take
    left -= take
  }
  return {
    paid,
    state: {
      ...state,
      players: state.players.map((p) => {
        if (p.characterId === targetId) {
          return { ...p, alive: true, vanished: null, diedOnFloor: null, lockoutDays: null, lockoutRolls: null }
        }
        const owed = paid[p.characterId] ?? 0
        return owed ? { ...p, quantumBasaltsEarned: p.quantumBasaltsEarned - owed } : p
      }),
    },
  }
}
