// Picture for a lore card: boss or enemy-family card art when triggered by
// boss_first_meet / family_first_meet, then its own lore art (src/art/lore/<card id>),
// card.imageUrl, its group's art (src/art/lore-groups/<group id>), or group.defaultImageUrl.
import { artUrl, type ArtKind } from '../art'
import { EMBEDDED_LORE_DECK } from './deck'
import type { LoreCard, LoreGroup } from './types'

const TRIGGER_ART_PREFIXES: readonly { prefix: string; kind: ArtKind }[] = [
  { prefix: 'boss_first_meet:', kind: 'bosses' },
  { prefix: 'family_first_meet:', kind: 'families' },
]

function triggerArtUrl(triggerKey: string): string | null {
  for (const { prefix, kind } of TRIGGER_ART_PREFIXES) {
    if (triggerKey.startsWith(prefix)) {
      const id = triggerKey.slice(prefix.length)
      return id ? artUrl(kind, id) : null
    }
  }
  return null
}

export function loreImageUrl(
  card: Pick<LoreCard, 'id' | 'group' | 'imageUrl'> & { trigger: Pick<LoreCard['trigger'], 'key'> },
  group?: Pick<LoreGroup, 'defaultImageUrl'>,
): string | null {
  return (
    triggerArtUrl(card.trigger.key) ??
    artUrl('lore', card.id) ??
    card.imageUrl ??
    artUrl('lore-groups', card.group) ??
    group?.defaultImageUrl ??
    null
  )
}

/** Look up current art URL for a deck card by id, falling back to `fallback` when missing or unpictured. */
export function loreImageUrlForCard(cardId: string, fallback: string | null): string | null {
  const card = EMBEDDED_LORE_DECK.cards.find((entry) => entry.id === cardId)
  if (!card) return fallback
  const group = EMBEDDED_LORE_DECK.groups.find((entry) => entry.id === card.group)
  return loreImageUrl(card, group) ?? fallback
}
