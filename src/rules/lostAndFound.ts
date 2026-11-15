// Lost and Found (design bible: Full clear rewards). When a player with uses
// left would be expelled, they vanish into the maze instead:
//   - "nextRoom" (Rank 1 timing): out of the fight. They miss its draft,
//     Devotion and Basalts, and reappear when the party reaches the next room
//     (the post-boss room after a boss) at half HP, boons intact.
//   - "endOfRound" (Rank 2 timing): back at the end of the current round,
//     where the DM chooses. They still count as in the fight.
// Rank 3 gives two uses; the second always has Rank 1 timing.
import type { RunPlayer, RunState } from '../model/run'
import { lostAndFoundUses } from './upgrades'

export type Vanish = NonNullable<RunPlayer['vanished']>

/** True for a living player who is in the fight (not vanished until the next room). */
export const inFight = (p: Pick<RunPlayer, 'alive' | 'vanished'>) => p.alive && p.vanished !== 'nextRoom'

/** Lost and Found uses this player has left this run. */
export function lostAndFoundLeft(p: Pick<RunPlayer, 'lostAndFoundRank' | 'lostAndFoundUsed'>): number {
  return Math.max(0, lostAndFoundUses(p.lostAndFoundRank ?? 0) - (p.lostAndFoundUsed ?? 0))
}

/** How this player would vanish if expelled now, or null when they'd be expelled. */
export function vanishTiming(p: Pick<RunPlayer, 'lostAndFoundRank' | 'lostAndFoundUsed'>): Vanish | null {
  if (lostAndFoundLeft(p) < 1) return null
  // Rank 2 and up: the first use comes back at the end of the round.
  return (p.lostAndFoundRank ?? 0) >= 2 && (p.lostAndFoundUsed ?? 0) === 0 ? 'endOfRound' : 'nextRoom'
}

/** What the party sees about a vanished player. */
export function vanishNote(timing: Vanish): string {
  return timing === 'nextRoom'
    ? "Lost in the maze: reappears at the start of the next room at half HP, boons intact. Misses this fight's draft, Devotion and Basalts."
    : "Lost in the maze: returns at the end of this round, somewhere in the room of the DM's choosing."
}

/** Spend a use: the player vanishes into the maze instead of being expelled. */
export function vanish(p: RunPlayer, timing: Vanish): RunPlayer {
  return { ...p, vanished: timing, lostAndFoundUsed: (p.lostAndFoundUsed ?? 0) + 1 }
}

/** Everyone in the maze comes back (the party reached the next room). */
export function returnVanished(state: RunState): RunState {
  if (!state.players.some((p) => p.vanished)) return state
  return { ...state, players: state.players.map((p) => (p.vanished ? { ...p, vanished: null } : p)) }
}

/** The DM brings one vanished player back into the room (end of the round, Rank 2 timing). */
export function returnFromMaze(state: RunState, characterId: string): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.characterId !== characterId) return p
      if (!p.vanished) throw new Error(`${p.name} isn't lost in the maze.`)
      return { ...p, vanished: null }
    }),
  }
}
