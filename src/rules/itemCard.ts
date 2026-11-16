// The rows of a gear or relic card (design bible: Gear item cards, Relic
// cards), in the bible's order. Other items show their effect text instead.
import { baseFields, gearBonus, gearRow, type CardField } from './gear'
import { itemValue, rarityName, relicOf, type LootItem } from './loot'

/** Relic data: a relic built on a weapon or armor names its base and bonus per state. */
interface RelicBase {
  base?: string
  bonus?: { dormant: number; woken: number }
  dormant: string
  woken: string
}

/** Drop a relic text's leading "A +2 longsword." (the card shows those stats as rows). */
const withoutBaseSentence = (text: string) => text.replace(/^An? \+\d+ [^.]+\.\s*/, '')

/** Card rows for one relic in its current state (used on item lists and Vault card backs). */
export function relicCardFields(
  id: string,
  state: 'dormant' | 'woken',
  options?: { wakeEffect?: boolean },
): CardField[] {
  const r = relicOf(id) as ReturnType<typeof relicOf> & RelicBase
  const woken = state === 'woken'
  const showWake = woken || (options?.wakeEffect ?? true)
  const rarityState = woken ? 'Awoken (legendary strength)' : 'Dormant (very rare strength)'
  const fields: CardField[] = [
    { label: 'Rarity and value', value: `Relic, ${rarityState}; none, can't be sold` },
    { label: 'Attunement', value: 'Required' },
  ]
  if (r.base && r.bonus) {
    fields.push(...baseFields(r.base, woken ? r.bonus.woken : r.bonus.dormant))
    fields.push({ label: 'Property', value: withoutBaseSentence(r.dormant) })
    if (showWake) fields.push({ label: woken ? 'Awoken' : 'When Awoken', value: withoutBaseSentence(r.woken) })
  } else {
    fields.push({ label: 'Effect', value: r.dormant })
    if (showWake) fields.push({ label: woken ? 'Awoken' : 'When Awoken', value: r.woken })
  }
  return fields
}

/** Card rows for gear and relics, or null for items that show only their text. */
export function cardFields(item: LootItem): CardField[] | null {
  if (item.kind === 'gear') {
    const rarity = item.rarity ?? 'common'
    const row = gearRow(item.ref)
    const fields: CardField[] = [
      { label: 'Rarity and value', value: `${rarityName(rarity)}, ${itemValue(item).toLocaleString()} credits` },
      { label: 'Attunement', value: rarity === 'legendary' ? 'Required' : 'No' },
      ...(item.base ? baseFields(item.base, gearBonus(rarity)) : []),
      { label: 'Property', value: row.property },
    ]
    const bonus = gearBonus(rarity)
    if (row.isFocus && bonus) fields.splice(fields.length - 1, 0, { label: 'Spellcasting', value: `+${bonus} to spell attacks and save DCs` })
    if (item.secondRef) fields.push({ label: 'Second property', value: gearRow(item.secondRef).property })
    if (!item.base) fields.splice(2, 0, { label: 'Base', value: 'Not recorded (rolled before gear cards)' })
    return fields
  }
  if (item.kind === 'relic') {
    return relicCardFields(item.ref, item.relicState ?? 'dormant')
  }
  return null
}
