// Item name colors by rarity, used wherever loot names show: common white,
// uncommon green, rare blue, very rare purple, legendary orange. Relics use a
// rainbow gradient (relic-name in index.css), with a golden glow once Awoken.
import type { LootItem } from '../rules/loot'

const RARITY_TEXT: Record<string, string> = {
  common: 'text-stone-50',
  uncommon: 'text-emerald-400',
  rare: 'text-blue-400',
  'very-rare': 'text-purple-400',
  legendary: 'text-orange-400',
}

/** Class for a relic's name: rainbow while Dormant, rainbow with a golden glow once Awoken. */
export const relicNameClass = (woken: boolean) => (woken ? 'relic-name relic-name-woken' : 'relic-name')

/** Class for an item's name, from its kind and rarity (no rarity, e.g. a trinket, reads as common). */
export function itemNameClass(item: Pick<LootItem, 'kind' | 'rarity' | 'relicState'>): string {
  if (item.kind === 'relic') return relicNameClass(item.relicState === 'woken')
  return RARITY_TEXT[item.rarity ?? 'common'] ?? RARITY_TEXT.common
}
