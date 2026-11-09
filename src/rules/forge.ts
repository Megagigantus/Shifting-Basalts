// The Forge (design bible: Room types). In the post-boss room, each living
// owner adds one use for the whole party. A use levels up a held boon, or
// evolves or combines eligible Level 3 boons. It cools when the party descends.
import type { RunPlayer, RunState } from '../model/run'
import { availableCombinations, combine, evolutionFor, evolve, levelUp, MAX_LEVEL, type Slot } from './boons'

export type ForgeAction =
  | { kind: 'level'; slotIndex: number }
  | { kind: 'evolve'; slotIndex: number }
  | { kind: 'combine'; combinationId: string }

export function forgeUsesLeft({ run }: RunState): number {
  return run.status === 'active' && run.awaitingChoice ? (run.forgeUsesLeft ?? 0) : 0
}

/** What one player could do at the Forge right now. */
export function forgeOptions(slots: Slot[]): ForgeAction[] {
  const options: ForgeAction[] = []
  slots.forEach((s, i) => {
    if (s?.kind === 'boon' && s.level < MAX_LEVEL) options.push({ kind: 'level', slotIndex: i })
    if (evolutionFor(s)) options.push({ kind: 'evolve', slotIndex: i })
  })
  for (const { combination } of availableCombinations(slots)) {
    options.push({ kind: 'combine', combinationId: combination.id })
  }
  return options
}

/** Spend one Forge use on a player's boons. */
export function spendForge(state: RunState, characterId: string, action: ForgeAction): RunState {
  if (forgeUsesLeft(state) < 1) throw new Error('The Forge has cooled (or isn\'t here).')
  const player = state.players.find((p) => p.characterId === characterId)
  if (!player) throw new Error('That character isn\'t in this run.')
  if (!player.alive) throw new Error(`${player.name} has fallen.`)
  const slots = player.slots ?? []
  let next: Slot[]
  if (action.kind === 'level') next = levelUp(slots, action.slotIndex)
  else if (action.kind === 'evolve') next = evolve(slots, action.slotIndex)
  else next = combine(slots, action.combinationId)
  return {
    run: { ...state.run, forgeUsesLeft: (state.run.forgeUsesLeft ?? 0) - 1 },
    players: state.players.map((p): RunPlayer => (p.characterId === characterId ? { ...p, slots: next } : p)),
  }
}
