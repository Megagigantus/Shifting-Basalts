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
