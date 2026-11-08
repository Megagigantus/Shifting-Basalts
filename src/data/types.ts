// The shapes of the game-content data files in this folder.
// Content comes from docs/design-bible.md. To add a boon, add an entry to
// boons.json; no code changes needed. Run `npm run check-data` afterwards.

/** "locked" = settled in the bible. "proposed" = current plan, may change. */
export type Status = 'locked' | 'proposed'

export type Tag =
  | 'Core'
  | 'Echo'
  | 'Reaper'
  | 'Spell'
  | 'Crit'
  | 'Stance'
  | 'Volley'
  | 'Shadow'
  | 'Rally'
  | 'Guard'
  | 'Bond'
  | 'Flurry'
  | 'Blood'
  | 'Hunt'
  | 'Payoff'

/** Stat tracks a Payoff boon can read from. */
export type StatTrackId =
  | 'max-hp'
  | 'spell-slot-recovery'
  | 'opening-temp-hp'
  | 'flat-damage'
  | 'healing-received'
  | 'speed'
  | 'fortune-dice'

/**
 * normal: levels 1 to 3, then evolves or combines.
 * core:   any character can draft it; never evolves or combines.
 * payoff: reads from a stat track; never evolves or combines.
 */
export type BoonKind = 'normal' | 'core' | 'payoff'

export interface Boon {
  id: string
  name: string
  tags: Tag[]
  kind: BoonKind
  /** Rules text for Level 1, Level 2 and Level 3, in that order. */
  levels: [string, string, string]
  /** Evolution id, if this boon evolves. */
  evolvesTo?: string
  /** Combination ids this boon can be part of. */
  combinesWith?: string[]
  /** Payoff boons only: the stat track it reads from. */
  payoffTrack?: StatTrackId
  status: Status
}

export interface Evolution {
  id: string
  name: string
  /** Boon id this evolves from. */
  from: string
  effect: string
  status: Status
}

export interface Combination {
  id: string
  name: string
  /** The two boon ids that fuse, both at Level 3. */
  boons: [string, string]
  effect: string
  status: Status
}
