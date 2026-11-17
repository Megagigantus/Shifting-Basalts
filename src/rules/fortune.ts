// Fortune Dice pools during a run (design bible: Boon catalogue > Stat tracks).
// Every function returns a new state or throws.
import type { RunPlayer, RunState } from '../model/run'
import { rankProgress, STAT_TRACKS } from './statTracks'

/** Stat track id for Fortune Dice. */
export const FORTUNE_TRACK = 'fortune-dice'

function fortuneTrackEffect() {
  const track = STAT_TRACKS.find((t) => t.id === FORTUNE_TRACK)
  if (!track) throw new Error(`Unknown stat track ${FORTUNE_TRACK}.`)
  return track.effect
}

/** Fortune Dice granted at run start from the character's Fortune Dice track rank. */
export function fortuneDicePerRun(trackDevotions: Record<string, number>): number {
  const rank = rankProgress(trackDevotions[FORTUNE_TRACK] ?? 0).rank
  const effect = fortuneTrackEffect()
  return Math.floor(rank / effect.every) * effect.amount
}

/** Fortune Dice left for this player in the current run. */
export function fortuneDiceLeft(p: Pick<RunPlayer, 'fortuneDice'>): number {
  return p.fortuneDice ?? 0
}

/** Spend 1 Fortune Die (e.g. for a reroll or a failed Gleam Dealer's Gamble). */
export function spendFortuneDie(state: RunState, characterId: string): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.characterId !== characterId) return p
      if (!p.alive) throw new Error(`${p.name} has fallen.`)
      const have = fortuneDiceLeft(p)
      if (have < 1) throw new Error(`${p.name} has no Fortune Dice left.`)
      return { ...p, fortuneDice: have - 1 }
    }),
  }
}

/** DM correction: set a player's Fortune Dice count directly. */
export function setFortuneDice(state: RunState, characterId: string, dice: number): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  if (!Number.isInteger(dice) || dice < 0) {
    throw new Error('Fortune Dice must be a whole number of 0 or more.')
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.characterId === characterId ? { ...p, fortuneDice: dice } : p,
    ),
  }
}
