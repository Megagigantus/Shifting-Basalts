// Type definitions for lore cards, groups, settings, and deck seed files.

/** How secret a lore card is: open (table-safe), guarded, or deep. */
export type LoreTier = 'open' | 'guarded' | 'deep'

/** How often a lore card can fire across runs. */
export type LoreRepeat = 'once_campaign' | 'once_run' | 'repeatable'

/** Origin of a lore card's material. */
export type LoreSource = 'canon' | 'loremaster' | 'both'

export interface LoreCard {
  id: string
  group: string
  title: string
  trigger: { key: string; label: string }
  repeat: LoreRepeat
  tier: LoreTier
  source: LoreSource
  readAloud: string
  push: string
  dmTruth: string
  placeholders: string[]
  imagePrompt: string
  imageUrl: string | null
  /** Position in the deck (set on import; lower fires first). Not in exported files. */
  order?: number
  /** True for a dispatch answer the DM wrote during play; left out of the full-collection count. */
  adHoc?: boolean
}

export interface LoreGroup {
  id: string
  name: string
  description: string
  defaultImageUrl: string | null
  defaultImagePrompt: string
}

export interface LoreSettings {
  tierLimit: LoreTier
  deepPerRun: number
  anchor: { name: string; voiceNote: string }
}

export interface LoreDeckFile {
  schemaVersion: number
  deck: string
  settings: LoreSettings
  groups: LoreGroup[]
  cards: LoreCard[]
}

/** loreState/main: the DM's deck settings and what has been seen. DM only. */
export interface LoreState {
  settings: LoreSettings
  /** Card id -> when it was revealed or dismissed (ms since epoch). */
  seen: Record<string, number>
}

/** loreSummary/main: what players may know about the deck, for the Library's "???" placeholders. */
export interface LoreSummary {
  groups: { id: string; name: string; count: number }[]
  /** Cards that count toward the full lore collection (ad hoc dispatch answers left out). */
  total: number
}
