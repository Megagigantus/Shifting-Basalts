// Picture for a lore card: its own art (src/art/lore/<card id>), then a URL
// set on the card, then its group's art (src/art/lore-groups/<group id>) or
// the group's URL. Null means a plain dark background.
import { artUrl } from '../art'
import type { LoreCard, LoreGroup } from './types'

export function loreImageUrl(card: Pick<LoreCard, 'id' | 'group' | 'imageUrl'>, group?: Pick<LoreGroup, 'defaultImageUrl'>): string | null {
  return artUrl('lore', card.id) ?? card.imageUrl ?? artUrl('lore-groups', card.group) ?? group?.defaultImageUrl ?? null
}
