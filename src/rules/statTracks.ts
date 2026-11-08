// Stat track math. Devotions are invested in a track one at a time; a few
// Devotions complete a rank. Costs and tier caps come from stat-tracks.json.
import data from '../data/stat-tracks.json'

export interface StatTrack {
  id: string
  name: string
  perRank: string
  /** Every `every` ranks give `amount` of `unit`. */
  effect: { every: number; amount: number; unit: string }
  status: string
}

export const STAT_TRACKS: StatTrack[] = data.tracks
export const MAX_RANK = Math.max(...data.rankCosts.map((b) => b.toRank))

/** Devotions needed to buy one specific rank (e.g. rank 6 costs 5). */
export function costOfRank(rank: number): number {
  const band = data.rankCosts.find((b) => rank >= b.fromRank && rank <= b.toRank)
  if (!band) throw new Error(`No rank ${rank}`)
  return band.devotions
}

/** Total Devotions invested to reach a rank from zero. */
export function devotionsForRank(rank: number): number {
  let total = 0
  for (let r = 1; r <= rank; r++) total += costOfRank(r)
  return total
}

/** The rank reached with this many Devotions invested, plus progress toward the next one. */
export function rankProgress(invested: number): { rank: number; towardNext: number; nextCost: number | null } {
  let rank = 0
  let spent = 0
  while (rank < MAX_RANK && spent + costOfRank(rank + 1) <= invested) {
    spent += costOfRank(rank + 1)
    rank++
  }
  return {
    rank,
    towardNext: invested - spent,
    nextCost: rank < MAX_RANK ? costOfRank(rank + 1) : null,
  }
}

/** Highest rank a character of this level may reach (tier caps). */
export function tierCap(level: number): number {
  const tier = data.tierCaps.find((t) => level >= t.minLevel && level <= t.maxLevel)
  return tier?.maxRank ?? 0
}

/** Most Devotions a character of this level may have invested in one track. */
export function investmentCap(level: number): number {
  return devotionsForRank(tierCap(level))
}

/** What a track adds at a given rank, as a modifier (never a full stat). */
export function effectAtRank(track: StatTrack, rank: number): string | null {
  const amount = Math.floor(rank / track.effect.every) * track.effect.amount
  if (amount === 0) return null
  return `+${amount} ${track.effect.unit}`
}
