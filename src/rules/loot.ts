// Loot (design bible: Loot tables, When loot drops, Floor loot roll, Amounts
// and rarity by floor, Reward math, Loot defaults). Pure functions with a
// controllable `random`; every step returns a new state or throws.
import rollData from '../data/loot-rolls.json'
import itemData from '../data/loot-items.json'
import relicData from '../data/relics.json'
import rules from '../data/rules.json'
import type { Run, RunPlayer, RunState } from '../model/run'
import type { Random } from './draft'
import { lootKeptPercent, withPressureBonus } from './run'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'very-rare' | 'legendary'
export type ItemKind = 'trinket' | 'consumable' | 'gear' | 'wondrous' | 'trophy' | 'relic'
export type LootSource = 'room' | 'elite' | 'cache' | 'cache-bonus' | 'trophy' | 'strider' | 'shrine' | 'vault'

/** One item in the party's pool (or, after extraction, on a character). */
export interface LootItem {
  uid: string
  kind: ItemKind
  /** Item id, or the trinket's index (as a string). */
  ref: string
  rarity: Rarity | null
  /** Legendary gear's second property (another gear id). */
  secondRef?: string
  floor: number
  room: number
  source: LootSource
  /** Relics only: Dormant or Woken. */
  relicState?: 'dormant' | 'woken'
}

export interface LootLogEntry {
  floor: number
  room: number
  source: LootSource
  credits?: number
  /** Basalts each living player banked from this roll. */
  basalts?: number
  itemUid?: string
}

/** The party's run loot: shared items and credits. Basalts go straight to players. */
export interface RunLoot {
  items: LootItem[]
  credits: number
  nextUid: number
  log: LootLogEntry[]
  /** Rooms whose strider remains were searched ("floor-room"). */
  searched: string[]
}

export const emptyLoot = (): RunLoot => ({ items: [], credits: 0, nextUid: 1, log: [], searched: [] })

const RARITIES = rollData.rarities.map((r) => r.id) as Rarity[]
const roll = (sides: number, random: Random) => 1 + Math.floor(random() * sides)
const pick = <T,>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]
const rollDice = (dice: number, sides: number, random: Random) =>
  Array.from({ length: dice }, () => roll(sides, random)).reduce((a, b) => a + b, 0)

export const rarityName = (r: Rarity) => rollData.rarities.find((x) => x.id === r)!.name
export const rarityValue = (r: Rarity) => rollData.rarities.find((x) => x.id === r)!.value

/** Entry tier of play: 1 (entry 5-10), 2 (11-16) or 3 (17-20). */
export function entryTier(partyLevel: number): 1 | 2 | 3 {
  const index = rules.entryTiers.findIndex((t) => partyLevel >= t.minLevel && partyLevel <= t.maxLevel)
  if (index >= 0) return (index + 1) as 1 | 2 | 3
  return partyLevel > 20 ? 3 : 1
}

/** Floors past 4 use floor 4's tables (floor 5's boss cache). */
export const lootFloor = (floor: number) => Math.min(Math.max(floor, 1), rollData.drops.lastLootFloor)

const amountsFor = (floor: number) => rollData.amounts.find((a) => a.floor === lootFloor(floor))!

/** The floor's item rarity for this entry tier (some rows upgrade on a d6 roll of 6). */
export function floorRarity(floor: number, partyLevel: number, random: Random): Rarity {
  const r = (amountsFor(floor).rarity as Record<string, { base: string; onSix?: string }>)[String(entryTier(partyLevel))]
  return (r.onSix && roll(6, random) === 6 ? r.onSix : r.base) as Rarity
}

export function stepRarity(r: Rarity, steps: number): Rarity {
  return RARITIES[Math.min(RARITIES.length - 1, RARITIES.indexOf(r) + steps)]
}

/** Pressures plus 5% per Extra Pressures owner (Loot defaults: Party reward bonus). */
export function partyRewardBonusPercent(run: Pick<Run, 'pressureBonusPercent' | 'extraPressuresBonusPercent'>): number {
  return run.pressureBonusPercent + (run.extraPressuresBonusPercent ?? 0)
}

// ---------------------------------------------------------------------------
// Reading items.

const consumableOf = (id: string) => itemData.consumables.find((c) => c.id === id)!
const gearOf = (id: string) => itemData.gear.find((g) => g.id === id)!
const wondrousOf = (id: string) =>
  Object.values(itemData.wondrous as Record<string, { id: string; name: string; effect: string }[]>)
    .flat()
    .find((w) => w.id === id)!
export const trophyOf = (id: string) => itemData.trophies.find((t) => t.id === id)!
export const trophyForBoss = (bossId: string) => itemData.trophies.find((t) => t.bossId === bossId) ?? null
export const relicOf = (id: string) => relicData.relics.find((r) => r.id === id)!

/** Credit value for the loot share (Value ladder; Loot defaults: Item values). */
export function itemValue(item: LootItem): number {
  if (item.kind === 'relic') return 0
  if (item.kind === 'trinket') return rollData.trinketValue
  const value = rarityValue(item.rarity ?? 'common')
  return item.kind === 'consumable' ? Math.floor(value * rollData.consumableValueShare) : value
}

export function itemName(item: LootItem): string {
  switch (item.kind) {
    case 'trinket':
      return 'Trinket'
    case 'consumable':
      return item.ref === 'healing-potion'
        ? (itemData.healingPotionGrades as Record<string, string>)[item.rarity ?? 'common']
        : consumableOf(item.ref).name
    case 'gear': {
      const bonus = (itemData.gearBonus as Record<string, number>)[item.rarity ?? 'common']
      return `${gearOf(item.ref).name}${bonus ? ` +${bonus}` : ''}`
    }
    case 'wondrous':
      return wondrousOf(item.ref).name
    case 'trophy':
      return trophyOf(item.ref).name
    case 'relic':
      return relicOf(item.ref).name
  }
}

export function itemText(item: LootItem): string {
  switch (item.kind) {
    case 'trinket':
      return itemData.trinkets[Number(item.ref)]
    case 'consumable':
      return consumableOf(item.ref).effect
    case 'gear': {
      const g = gearOf(item.ref)
      const second = item.secondRef ? ` Also: ${gearOf(item.secondRef).property}` : ''
      return `${g.base}. ${g.property}${second}`
    }
    case 'wondrous':
      return wondrousOf(item.ref).effect
    case 'trophy':
      return trophyOf(item.ref).effect
    case 'relic': {
      const r = relicOf(item.ref)
      return item.relicState === 'woken' ? `${r.dormant} Woken: ${r.woken}` : r.dormant
    }
  }
}

// ---------------------------------------------------------------------------
// Rolling.

type NewItem = Omit<LootItem, 'uid' | 'source' | 'floor' | 'room'>

function rollItem(kind: 'trinket' | 'consumable' | 'gear' | 'wondrous', rarity: Rarity, random: Random): NewItem {
  if (kind === 'trinket') return { kind, ref: String(roll(itemData.trinkets.length, random) - 1), rarity: null }
  if (kind === 'consumable') return { kind, ref: pick(itemData.consumables, random).id, rarity }
  if (kind === 'gear') {
    const first = pick(itemData.gear, random).id
    if (rarity !== itemData.gearSecondPropertyAt) return { kind, ref: first, rarity }
    const second = pick(itemData.gear.filter((g) => g.id !== first), random).id
    return { kind, ref: first, rarity, secondRef: second }
  }
  const table = (itemData.wondrous as Record<string, { id: string }[]>)[rarity]
  return { kind, ref: pick(table, random).id, rarity }
}

export type Drop = { kind: 'credits'; amount: number } | { kind: 'basalts'; amount: number } | { kind: 'item'; item: NewItem }

/** One roll on the floor loot roll (d100), with the floor's amounts and rarity. */
export function floorRoll(run: Run, floor: number, random: Random): Drop {
  const row = rollData.floorRoll.find((r) => r.floor === lootFloor(floor))!
  const d100 = roll(100, random)
  const kind = row.table.find((t) => d100 <= t.upTo)!.kind
  const amounts = amountsFor(floor)
  if (kind === 'credits') {
    const base = rollDice(amounts.credits.dice, amounts.credits.sides, random) * amounts.credits.times * run.entryMultiplier
    return { kind: 'credits', amount: withPressureBonus(base, partyRewardBonusPercent(run)) }
  }
  if (kind === 'basalts') {
    const b = amounts.basalts
    return { kind: 'basalts', amount: (rollDice(b.dice, b.sides, random) + b.plus) * run.entryMultiplier }
  }
  const rarity = floorRarity(floor, run.partyLevel, random)
  return { kind: 'item', item: rollItem(kind as 'trinket' | 'consumable' | 'gear' | 'wondrous', rarity, random) }
}

/** Add drops to the party's pool; Basalts go to every living player (banked like boss Basalts). */
export function applyDrops(state: RunState, drops: Drop[], source: LootSource): RunState {
  const { run } = state
  const loot: RunLoot = structuredClone(run.loot ?? emptyLoot())
  let players: RunPlayer[] = state.players
  const at = { floor: run.floor, room: run.room, source }
  for (const drop of drops) {
    if (drop.kind === 'credits') {
      loot.credits += drop.amount
      loot.log.push({ ...at, credits: drop.amount })
    } else if (drop.kind === 'basalts') {
      players = players.map((p) => (p.alive ? { ...p, quantumBasaltsEarned: p.quantumBasaltsEarned + drop.amount } : p))
      loot.log.push({ ...at, basalts: drop.amount })
    } else {
      const uid = `L${loot.nextUid++}`
      loot.items.push({ ...drop.item, uid, ...at })
      loot.log.push({ ...at, itemUid: uid })
    }
  }
  return { ...state, run: { ...run, loot }, players }
}

/** A cleared room's loot: 1 roll for combat, 2 for elite, none for a Reprieve. */
export function roomLoot(state: RunState, kind: 'combat' | 'elite' | 'reprieve', random: Random): RunState {
  const rolls = kind === 'elite' ? rollData.drops.elite : kind === 'combat' ? rollData.drops.combat : 0
  const drops = Array.from({ length: rolls }, () => floorRoll(state.run, state.run.floor, random))
  return applyDrops(state, drops, kind === 'elite' ? 'elite' : 'room')
}

/** How many floor rolls a boss cache gets: 2, plus 1 per full 50% of the party reward bonus. */
export function cacheRolls(run: Run): number {
  return rollData.drops.cacheRolls + Math.floor(partyRewardBonusPercent(run) / rollData.drops.extraCacheRollPerBonusPercent)
}

/** A boss cache: floor rolls, a wondrous item one rarity up, and the trophy on a d6 roll of 5 or 6. */
export function bossCache(state: RunState, bossId: string | null, random: Random): RunState {
  const { run } = state
  const rolls = Array.from({ length: cacheRolls(run) }, () => floorRoll(run, run.floor, random))
  let next = applyDrops(state, rolls, 'cache')
  const rarity = stepRarity(floorRarity(run.floor, run.partyLevel, random), rollData.drops.cacheBonusRarityStep)
  next = applyDrops(next, [{ kind: 'item', item: rollItem('wondrous', rarity, random) }], 'cache-bonus')
  const trophy = bossId ? trophyForBoss(bossId) : null
  if (trophy && rollData.drops.trophyOn.includes(roll(6, random))) {
    next = applyDrops(next, [{ kind: 'item', item: { kind: 'trophy', ref: trophy.id, rarity: trophy.rarity as Rarity } }], 'trophy')
  }
  return next
}

/** Search DC for strider remains on a floor. */
export const striderSearchDC = (floor: number) => rollData.striderRemains.dcBase + floor

/** Strider remains, searched: 1 trinket, plus 1 consumable when the check beat the DC by 5 or more. Once per room. */
export function searchStriderRemains(state: RunState, beatBy5: boolean, random: Random): RunState {
  const { run } = state
  const key = `${run.floor}-${run.room}`
  if (run.loot?.searched.includes(key)) throw new Error('These remains have already been searched.')
  const rarity = floorRarity(run.floor, run.partyLevel, random)
  const drops: Drop[] = [{ kind: 'item', item: rollItem('trinket', rarity, random) }]
  if (beatBy5) drops.push({ kind: 'item', item: rollItem('consumable', rarity, random) })
  const next = applyDrops(state, drops, 'strider')
  return { ...next, run: { ...next.run, loot: { ...next.run.loot!, searched: [...next.run.loot!.searched, key] } } }
}

const REROLLABLE: LootSource[] = ['room', 'elite', 'cache', 'shrine']

/** Items a shrine offering may reroll: this floor's floor-roll items. */
export function rerollableItems(state: RunState): LootItem[] {
  return (state.run.loot?.items ?? []).filter((i) => i.floor === state.run.floor && REROLLABLE.includes(i.source))
}

/** Shrine to Thils: offer a trinket to reroll one loot roll from this floor. */
export function shrineOffering(state: RunState, trinketUid: string, targetUid: string, random: Random): RunState {
  const loot = state.run.loot
  const trinket = loot?.items.find((i) => i.uid === trinketUid)
  if (!trinket || trinket.kind !== 'trinket') throw new Error('Offer a trinket from the party\'s loot.')
  if (trinketUid === targetUid) throw new Error('The offering can\'t be the roll it rerolls.')
  const target = rerollableItems(state).find((i) => i.uid === targetUid)
  if (!target) throw new Error('Pick a loot roll from this floor to reroll.')
  const without: RunState = {
    ...state,
    run: { ...state.run, loot: { ...loot!, items: loot!.items.filter((i) => i.uid !== trinketUid && i.uid !== targetUid) } },
  }
  return applyDrops(without, [floorRoll(state.run, target.floor, random)], 'shrine')
}

// ---------------------------------------------------------------------------
// Extraction: the loot share.

export const COLLECTORS_EYE = 'collectors-eye'

/** Total credit value of the party's pool (items plus credits). */
export function poolValue(loot: RunLoot | null | undefined): number {
  if (!loot) return 0
  return loot.credits + loot.items.reduce((s, i) => s + itemValue(i), 0)
}

/** Share kept on extraction: floor share + Deep Pockets + Collector's Eye (+10 once), at most 100%. */
export function keptPercent({ run, players }: RunState): number {
  const base = lootKeptPercent(run.lastBossFloor)
  if (base === 0) return 0
  const eye = players.some((p) => p.alive && p.hiddenBoonId === COLLECTORS_EYE) ? 10 : 0
  return Math.min(100, base + (run.deepPocketsPercent ?? 0) + eye)
}

export function keptValue(state: RunState): number {
  return Math.floor((poolValue(state.run.loot) * keptPercent(state)) / 100)
}

export interface LootPick {
  uid: string
  characterId: string
}

export interface LootShare {
  keptPercent: number
  keptValue: number
  itemsValue: number
  /** Unused kept value, paid out in credits at the table. */
  creditsPayout: number
  picks: LootPick[]
}

/** Check the party's picks fit the kept value; the rest is paid in credits. */
export function planShare(state: RunState, picks: LootPick[]): LootShare {
  const items = state.run.loot?.items ?? []
  const seen = new Set<string>()
  let itemsValue = 0
  for (const p of picks) {
    const item = items.find((i) => i.uid === p.uid)
    if (!item) throw new Error('That item isn\'t in the party\'s loot.')
    if (seen.has(p.uid)) throw new Error(`${itemName(item)} is picked twice.`)
    seen.add(p.uid)
    if (!state.players.some((pl) => pl.characterId === p.characterId)) throw new Error('Assign items to characters in this run.')
    itemsValue += itemValue(item)
  }
  const percent = keptPercent(state)
  const value = keptValue(state)
  if (itemsValue > value) {
    throw new Error(`Those items are worth ${itemsValue.toLocaleString()} credits; the party keeps ${value.toLocaleString()}.`)
  }
  return { keptPercent: percent, keptValue: value, itemsValue, creditsPayout: value - itemsValue, picks }
}
