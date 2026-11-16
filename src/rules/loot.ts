// Loot (design bible: Loot tables, When loot drops, Floor loot roll, Amounts
// and rarity by floor, Reward math, Loot defaults). Pure functions with a
// controllable `random`; every step returns a new state or throws.
import rollData from '../data/loot-rolls.json'
import itemData from '../data/loot-items.json'
import relicData from '../data/relics.json'
import rules from '../data/rules.json'
import type { Run, RunPlayer, RunState } from '../model/run'
import { inFight } from './lostAndFound'
import type { Random } from './draft'
import { lootKeptPercent, withPressureBonus } from './run'
import { baseCost, gearName, gearRow, rollGear, usableBases } from './gear'

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
  /** Gear: the base weapon or armor (gear-bases.json id). Older drops have none. */
  base?: string
  /** Gear: the character the roll was aimed at (Who gear drops for). */
  forCharacterId?: string
  floor: number
  room: number
  source: LootSource
  /** Relics only: Dormant or Awoken (stored as 'woken'). */
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
  if (item.kind === 'gear') return Math.round(value + baseCost(item.base)) // gear adds its base item's cost
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
    case 'gear':
      return gearName(item)
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
      return `${g.property}${second}`
    }
    case 'wondrous':
      return wondrousOf(item.ref).effect
    case 'trophy':
      return trophyOf(item.ref).effect
    case 'relic': {
      const r = relicOf(item.ref)
      return item.relicState === 'woken' ? `${r.dormant} Awoken: ${r.woken}` : r.dormant
    }
  }
}

// ---------------------------------------------------------------------------
// Rolling.

type NewItem = Omit<LootItem, 'uid' | 'source' | 'floor' | 'room'>

function rollItem(
  kind: 'trinket' | 'consumable' | 'gear' | 'wondrous',
  rarity: Rarity,
  random: Random,
  players: Pick<RunPlayer, 'characterId' | 'training'>[] = [],
  aimAt?: string,
): NewItem {
  if (kind === 'trinket') return { kind, ref: String(roll(itemData.trinkets.length, random) - 1), rarity: null }
  if (kind === 'consumable') return { kind, ref: pick(itemData.consumables, random).id, rarity }
  if (kind === 'gear') return { kind, rarity, ...rollGear(players, rarity, random, aimAt) }
  const table = (itemData.wondrous as Record<string, { id: string }[]>)[rarity]
  return { kind, ref: pick(table, random).id, rarity }
}

export type Drop = { kind: 'credits'; amount: number } | { kind: 'basalts'; amount: number } | { kind: 'item'; item: NewItem }

/** One roll on the floor loot roll (d100), with the floor's amounts and rarity. */
export function floorRoll(run: Run, floor: number, random: Random, players: Pick<RunPlayer, 'characterId' | 'training'>[] = []): Drop {
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
  return { kind: 'item', item: rollItem(kind as 'trinket' | 'consumable' | 'gear' | 'wondrous', rarity, random, players) }
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
      players = players.map((p) => (inFight(p) ? { ...p, quantumBasaltsEarned: p.quantumBasaltsEarned + drop.amount } : p))
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
  const drops = Array.from({ length: rolls }, () => floorRoll(state.run, state.run.floor, random, state.players))
  return applyDrops(state, drops, kind === 'elite' ? 'elite' : 'room')
}

/** How many floor rolls a boss cache gets: 2, plus 1 per full 50% of the party reward bonus. */
export function cacheRolls(run: Run): number {
  return rollData.drops.cacheRolls + Math.floor(partyRewardBonusPercent(run) / rollData.drops.extraCacheRollPerBonusPercent)
}

/** A boss cache: floor rolls, a wondrous item one rarity up, and the trophy on a d6 roll of 5 or 6. */
export function bossCache(state: RunState, bossId: string | null, random: Random): RunState {
  const { run } = state
  const rolls = Array.from({ length: cacheRolls(run) }, () => floorRoll(run, run.floor, random, state.players))
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

/** Shrine to Thils: offer a trinket to reroll one loot roll from this floor into a new item of the same kind. */
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
  const kind = target.kind as 'trinket' | 'consumable' | 'gear' | 'wondrous'
  // Same kind and rarity, but a different item when the table allows one.
  // Gear stays aimed at the same character.
  const reroll = () => rollItem(kind, target.rarity ?? 'common', random, state.players, target.forCharacterId)
  let item = reroll()
  for (let tries = 0; item.ref === target.ref && tries < 20; tries++) item = reroll()
  return applyDrops(without, [{ kind: 'item', item }], 'shrine')
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

/** Boss trophies are always kept and never count against the loot share. */
export const isFreeKeep = (item: LootItem) => item.kind === 'trophy'

/** The pool's value that the loot share is cut from: everything except boss trophies. */
export function shareableValue(loot: RunLoot | null | undefined): number {
  if (!loot) return 0
  return loot.credits + loot.items.reduce((s, i) => s + (isFreeKeep(i) ? 0 : itemValue(i)), 0)
}

export function keptValue(state: RunState): number {
  return Math.floor((shareableValue(state.run.loot) * keptPercent(state)) / 100)
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
    if (!isFreeKeep(item)) itemsValue += itemValue(item)
  }
  const unpicked = items.find((i) => isFreeKeep(i) && !seen.has(i.uid))
  if (unpicked) throw new Error(`${itemName(unpicked)} always goes home: assign it to someone.`)
  const percent = keptPercent(state)
  const value = keptValue(state)
  if (itemsValue > value) {
    throw new Error(`Those items are worth ${itemsValue.toLocaleString()} credits; the party keeps ${value.toLocaleString()}.`)
  }
  return { keptPercent: percent, keptValue: value, itemsValue, creditsPayout: value - itemsValue, picks }
}

// ---------------------------------------------------------------------------
// DM override for gear (Who gear drops for): pick the base, or aim the roll at
// a different character.

function changeItem(state: RunState, uid: string, change: (item: LootItem) => LootItem): RunState {
  const loot = state.run.loot
  const item = loot?.items.find((i) => i.uid === uid)
  if (!loot || !item) throw new Error("That item isn't in the party's loot.")
  return { ...state, run: { ...state.run, loot: { ...loot, items: loot.items.map((i) => (i.uid === uid ? change(i) : i)) } } }
}

/** The DM picks a gear drop's base from its row's bases. */
export function setGearBase(state: RunState, uid: string, baseId: string): RunState {
  return changeItem(state, uid, (item) => {
    if (item.kind !== 'gear') throw new Error('Only gear has a base.')
    if (!gearRow(item.ref).bases.includes(baseId)) throw new Error("That base isn't one this gear can roll.")
    return { ...item, base: baseId }
  })
}

/** The DM aims a gear drop at another character: a fresh row and base they can use, same rarity. */
export function reaimGear(state: RunState, uid: string, characterId: string, random: Random): RunState {
  if (!state.players.some((p) => p.characterId === characterId)) throw new Error('Aim at a character in this run.')
  return changeItem(state, uid, (item) => {
    if (item.kind !== 'gear') throw new Error('Only gear can be aimed.')
    const { kind, rarity, uid: id, floor, room, source } = item
    return { kind, rarity, uid: id, floor, room, source, ...rollGear(state.players, rarity ?? 'common', random, characterId) }
  })
}

/** Bases the DM may pick for a gear drop, and which ones the aimed character can use. */
export function gearBaseChoices(state: RunState, item: LootItem): { id: string; usable: boolean }[] {
  const training = state.players.find((p) => p.characterId === item.forCharacterId)?.training
  const usable = new Set(usableBases(gearRow(item.ref), training))
  return gearRow(item.ref).bases.map((id) => ({ id, usable: usable.has(id) }))
}

/** What the room just cleared added to the pool (Room cleared pop-up): its items, credits, and the Basalts each player got. Vault relics are left out. */
export function roomDrops(state: RunState): { items: LootItem[]; credits: number; basalts: number } {
  const last = state.run.log.at(-1)
  const loot = state.run.loot
  if (!last || !loot) return { items: [], credits: 0, basalts: 0 }
  const here = loot.log.filter((l) => l.floor === last.floor && l.room === last.room && l.source !== 'vault')
  const uids = new Set(here.map((l) => l.itemUid).filter(Boolean))
  return {
    items: loot.items.filter((i) => uids.has(i.uid)),
    credits: here.reduce((sum, l) => sum + (l.credits ?? 0), 0),
    basalts: here.reduce((sum, l) => sum + (l.basalts ?? 0), 0),
  }
}
