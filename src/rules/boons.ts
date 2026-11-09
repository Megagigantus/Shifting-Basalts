// Boon slot rules for one player during a run (design bible: Boon system
// rules, Build clarifications 1, 4 and 5). Every function returns a new list
// of slots, or throws if the move isn't allowed.
import boonsData from '../data/boons.json'
import evolutionsData from '../data/evolutions.json'
import combinationsData from '../data/combinations.json'
import hiddenData from '../data/hidden-boons.json'
import type { Boon, Combination, Evolution, HiddenBoon } from '../data/types'

export const BOONS = boonsData as Boon[]
export const EVOLUTIONS = evolutionsData as Evolution[]
export const COMBINATIONS = combinationsData as Combination[]
export const HIDDEN_BOONS = hiddenData as HiddenBoon[]

export const BASE_SLOTS = 3
export const MAX_LEVEL = 3

/** What sits in a boon slot. */
export type SlotContent =
  | { kind: 'boon'; boonId: string; level: number; suppressed?: boolean }
  | { kind: 'evolution'; evolutionId: string; suppressed?: boolean }
  | { kind: 'combination'; combinationId: string; suppressed?: boolean }

export type Slot = SlotContent | null

export function boon(id: string): Boon {
  const found = BOONS.find((b) => b.id === id)
  if (!found) throw new Error(`Unknown boon ${id}`)
  return found
}
export function evolution(id: string): Evolution {
  const found = EVOLUTIONS.find((e) => e.id === id)
  if (!found) throw new Error(`Unknown evolution ${id}`)
  return found
}
export function combination(id: string): Combination {
  const found = COMBINATIONS.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown combination ${id}`)
  return found
}
export function hiddenBoon(id: string): HiddenBoon {
  const found = HIDDEN_BOONS.find((h) => h.id === id)
  if (!found) throw new Error(`Unknown hidden boon ${id}`)
  return found
}

/** Boon slots for a character: 3, plus one per Extra Boon Slot rank. */
export function slotCount(extraBoonSlotRank: number): number {
  return BASE_SLOTS + extraBoonSlotRank
}

export function emptySlots(count: number): Slot[] {
  return Array.from({ length: count }, () => null)
}

/** Display name of whatever is in a slot. */
export function slotName(slot: SlotContent): string {
  if (slot.kind === 'boon') return boon(slot.boonId).name
  if (slot.kind === 'evolution') return evolution(slot.evolutionId).name
  return combination(slot.combinationId).name
}

/** Tags a slot carries: Evolutions keep their source's tag, Combinations carry both (clarification 5). */
export function slotTags(slot: SlotContent): string[] {
  if (slot.kind === 'boon') return boon(slot.boonId).tags
  if (slot.kind === 'evolution') return boon(evolution(slot.evolutionId).from).tags
  const tags = combination(slot.combinationId).boons.flatMap((id) => boon(id).tags)
  return [...new Set(tags)]
}

/** Boon ids a slot "uses up": the boon itself, an evolution's source, or both of a combination's. */
function boonsIn(slot: SlotContent): string[] {
  if (slot.kind === 'boon') return [slot.boonId]
  if (slot.kind === 'evolution') return [evolution(slot.evolutionId).from]
  return combination(slot.combinationId).boons
}

function checkIndex(slots: Slot[], index: number) {
  if (index < 0 || index >= slots.length) throw new Error('No such slot.')
}

function replaceAt(slots: Slot[], index: number, value: Slot): Slot[] {
  return slots.map((s, i) => (i === index ? value : s))
}

/**
 * Take a boon from an offer (or the DM's pick). If it's already held as a
 * plain boon it levels up instead (clarification 1). Otherwise it goes in the
 * first empty slot at Level 1.
 */
export function takeBoon(slots: Slot[], boonId: string): Slot[] {
  const picked = boon(boonId)
  const heldAt = slots.findIndex((s) => s?.kind === 'boon' && s.boonId === boonId)
  if (heldAt >= 0) return levelUp(slots, heldAt)
  if (slots.some((s) => s && boonsIn(s).includes(boonId))) {
    throw new Error(`${picked.name} is already part of an Evolution or Combination this player holds.`)
  }
  const empty = slots.findIndex((s) => s === null)
  if (empty < 0) throw new Error('No empty slot. Replace a boon instead.')
  return replaceAt(slots, empty, { kind: 'boon', boonId, level: 1 })
}

/** Drop whatever is in a slot and put a new boon there at Level 1. */
export function replaceBoon(slots: Slot[], index: number, boonId: string): Slot[] {
  checkIndex(slots, index)
  const picked = boon(boonId)
  const others = slots.filter((_, i) => i !== index)
  if (others.some((s) => s && boonsIn(s).includes(boonId))) {
    throw new Error(`${picked.name} is already held in another slot.`)
  }
  return replaceAt(slots, index, { kind: 'boon', boonId, level: 1 })
}

/** Raise a plain boon one level, up to Level 3 (drafting it again, the Forge, or Reflect). */
export function levelUp(slots: Slot[], index: number): Slot[] {
  checkIndex(slots, index)
  const slot = slots[index]
  if (!slot || slot.kind !== 'boon') throw new Error('Only a plain boon can level up.')
  if (slot.level >= MAX_LEVEL) throw new Error(`${boon(slot.boonId).name} is already Level 3.`)
  return replaceAt(slots, index, { ...slot, level: slot.level + 1 })
}

/** The Evolution a slot can become right now, or null. */
export function evolutionFor(slot: Slot): Evolution | null {
  if (!slot || slot.kind !== 'boon' || slot.level < MAX_LEVEL) return null
  const b = boon(slot.boonId)
  if (b.kind !== 'normal' || !b.evolvesTo) return null
  return evolution(b.evolvesTo)
}

export function evolve(slots: Slot[], index: number): Slot[] {
  checkIndex(slots, index)
  const evo = evolutionFor(slots[index])
  if (!evo) throw new Error('This slot can\'t evolve: it needs a Level 3 boon with an Evolution.')
  return replaceAt(slots, index, { kind: 'evolution', evolutionId: evo.id })
}

/** Combinations this player could make right now: both boons held at Level 3. */
export function availableCombinations(slots: Slot[]): { combination: Combination; slots: [number, number] }[] {
  const atLevel3 = new Map<string, number>()
  slots.forEach((s, i) => {
    if (s?.kind === 'boon' && s.level >= MAX_LEVEL && boon(s.boonId).kind === 'normal') atLevel3.set(s.boonId, i)
  })
  return COMBINATIONS.filter((c) => c.boons.every((id) => atLevel3.has(id))).map((c) => ({
    combination: c,
    slots: [atLevel3.get(c.boons[0])!, atLevel3.get(c.boons[1])!],
  }))
}

/** Fuse two Level 3 boons: the result takes the first boon's slot and the second slot opens up. */
export function combine(slots: Slot[], combinationId: string): Slot[] {
  const option = availableCombinations(slots).find((o) => o.combination.id === combinationId)
  if (!option) throw new Error('Both boons must be held at Level 3 to combine.')
  const [first, second] = option.slots
  return slots.map((s, i) =>
    i === first ? { kind: 'combination', combinationId } : i === second ? null : s,
  )
}

/** Mark a slot suppressed (or not), e.g. by the Inverted Reliquary or Memory Drain. */
export function setSuppressed(slots: Slot[], index: number, suppressed: boolean): Slot[] {
  checkIndex(slots, index)
  const slot = slots[index]
  if (!slot) throw new Error('That slot is empty.')
  return replaceAt(slots, index, { ...slot, suppressed })
}

/** Empty a slot (a DM correction). */
export function clearSlot(slots: Slot[], index: number): Slot[] {
  checkIndex(slots, index)
  return replaceAt(slots, index, null)
}

/** Rules text for a slot: every level reached for plain boons, the effect otherwise. */
export function slotRulesText(slot: SlotContent): string[] {
  if (slot.kind === 'boon') {
    return boon(slot.boonId).levels.slice(0, slot.level).map((text, i) => `Level ${i + 1}: ${text}`)
  }
  if (slot.kind === 'evolution') return [evolution(slot.evolutionId).effect]
  return [combination(slot.combinationId).effect]
}

/** One-line summary of held boons, e.g. "Hardy 2 · Chain of Echoes · hidden: Keeper of Ways". */
export function boonSummary(slots: Slot[] | undefined, hiddenBoonId?: string | null): string {
  const held = (slots ?? []).filter((s): s is SlotContent => s !== null)
  const parts = held.map((s) => (s.kind === 'boon' ? `${slotName(s)} ${s.level}` : slotName(s)))
  if (hiddenBoonId) parts.push(`hidden: ${hiddenBoon(hiddenBoonId).name}`)
  return parts.join(' · ')
}

/**
 * Grow (or keep) a slot list to match the slot count, e.g. after an Extra
 * Boon Slot purchase. Never removes filled slots.
 */
export function fitSlots(slots: Slot[] | undefined, count: number): Slot[] {
  const current = slots ?? []
  if (current.length >= count) return current
  return [...current, ...emptySlots(count - current.length)]
}
