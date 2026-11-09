// Building draft offers (design bible Build clarifications 12 to 15).
// Every function takes a `random` source returning numbers in [0, 1), so tests
// can control the dice. The app passes Math.random.
import classTagData from '../data/class-tags.json'
import type { Boon } from '../data/types'
import {
  availableCombinations,
  BOONS,
  boon,
  boonsIn,
  evolutionFor,
  HIDDEN_BOONS,
  MAX_LEVEL,
  slotTags,
  type Slot,
  type SlotContent,
} from './boons'
import { rankProgress } from './statTracks'

export type Random = () => number

/** One choice in a draft offer. */
export type Offer =
  | { kind: 'boon'; boonId: string; source: 'held' | 'weighted' | 'wildcard' | 'starting' }
  | { kind: 'evolution'; evolutionId: string; slotIndex: number; source: 'wildcard' }
  | { kind: 'combination'; combinationId: string; source: 'wildcard' }

/** What the generator needs to know about a character. */
export interface DraftCharacter {
  classId: string
  casterType: string
  hasSummon: boolean
  trackDevotions: Record<string, number>
  /** Boon ids on this character's Banish list. */
  banished?: string[]
  /** Extra tags treated as primary for this character (a subclass shift). */
  favoredTags?: string[]
}

type SlotPlan = 'held' | 'weighted' | 'wildcard'

const WEIGHTS = classTagData.weights
const MAX_PER_TAG = classTagData.maxPerTag

function classRow(classId: string) {
  return classTagData.classes.find((c) => c.classId === classId)
}

/** Can this character ever be offered this boon? */
export function canUse(b: Boon, character: DraftCharacter): boolean {
  const needsSpells = b.tags.includes('Spell') || b.requires?.includes('spells')
  const needsSummon = b.tags.includes('Bond') || b.requires?.includes('summon')
  if (needsSpells && character.casterType === 'none') return false
  if (needsSummon && !character.hasSummon) return false
  if (b.payoffTrack && rankProgress(character.trackDevotions[b.payoffTrack] ?? 0).rank < 1) return false
  return true
}

/** Boons that may appear as new picks: usable, not banished and not already held in any form. */
export function eligibleBoons(character: DraftCharacter, heldBoonIds: string[]): Boon[] {
  const banished = new Set(character.banished ?? [])
  const held = new Set(heldBoonIds)
  return BOONS.filter((b) => canUse(b, character) && !banished.has(b.id) && !held.has(b.id))
}

/** A boon's draft weight for this character (Core boons always 1). */
export function boonWeight(b: Boon, classId: string, heldTags: Set<string>, favoredTags: string[] = []): number {
  if (b.kind === 'core') return WEIGHTS.base
  const row = classRow(classId)
  const tag = b.tags[0]
  let weight = WEIGHTS.base
  if (row?.primary.includes(tag) || favoredTags.includes(tag)) weight *= WEIGHTS.primaryTag
  else if (row?.secondary.includes(tag)) weight *= WEIGHTS.secondaryTag
  if (heldTags.has(tag)) weight *= WEIGHTS.heldTag
  return weight
}

/** Pick one item with probability proportional to its weight. */
export function weightedPick<T>(items: T[], weight: (item: T) => number, random: Random): T | null {
  const total = items.reduce((sum, item) => sum + weight(item), 0)
  if (items.length === 0 || total <= 0) return null
  let roll = random() * total
  for (const item of items) {
    roll -= weight(item)
    if (roll < 0) return item
  }
  return items[items.length - 1]
}

/** Which slots an offer has: 4 normally, fewer under Narrow Seam (Elite rooms keep the wildcard). */
export function slotPlan(offerSize: number, elite: boolean): SlotPlan[] {
  if (offerSize >= 4) return ['held', 'weighted', 'weighted', 'wildcard']
  if (offerSize === 3) return ['held', 'weighted', 'wildcard']
  return elite ? ['held', 'wildcard'] : ['held', 'weighted']
}

export interface OfferInput {
  character: DraftCharacter
  slots: Slot[]
  /** 4, or 3 under Narrow Seam, or 2 under Narrow Seam II. */
  offerSize: number
  elite?: boolean
  /** Attunement: the first offer of a run includes a boon with this tag, if one is eligible. */
  attuneTag?: string | null
  random: Random
}

/** Build one player's draft offer. */
export function generateOffer({ character, slots, offerSize, elite = false, attuneTag = null, random }: OfferInput): Offer[] {
  const held = slots.filter((s): s is SlotContent => s !== null)
  const heldPlain = held.filter((s): s is Extract<SlotContent, { kind: 'boon' }> => s.kind === 'boon')
  const heldBoonIds = held.flatMap(boonsIn)
  const heldTags = new Set(held.flatMap((s) => slotTags(s)))
  const pool = eligibleBoons(character, heldBoonIds)

  const offers: Offer[] = []
  const tagCounts = new Map<string, number>()
  const used = new Set<string>()
  const note = (b: Boon) => {
    used.add(b.id)
    tagCounts.set(b.tags[0], (tagCounts.get(b.tags[0]) ?? 0) + 1)
  }
  const roomFor = (b: Boon) => !used.has(b.id) && (tagCounts.get(b.tags[0]) ?? 0) < MAX_PER_TAG

  const weightedRoll = (onlyTag?: string | null): Boon | null => {
    const candidates = pool.filter((b) => roomFor(b) && (!onlyTag || b.tags[0] === onlyTag))
    return weightedPick(candidates, (b) => boonWeight(b, character.classId, heldTags, character.favoredTags), random)
  }
  const evenRoll = (): Boon | null => {
    const candidates = pool.filter(roomFor)
    return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null
  }
  const wildcard = (): Offer | null => {
    const options: Offer[] = []
    slots.forEach((s, i) => {
      const evo = evolutionFor(s)
      if (evo) options.push({ kind: 'evolution', evolutionId: evo.id, slotIndex: i, source: 'wildcard' })
    })
    for (const { combination } of availableCombinations(slots)) {
      options.push({ kind: 'combination', combinationId: combination.id, source: 'wildcard' })
    }
    // Skip any Evolution or Combination already in this offer (slot 1 can be a wildcard too).
    const fresh = options.filter((o) => !isDuplicate(offers, o))
    if (fresh.length) return fresh[Math.floor(random() * fresh.length)]
    const b = evenRoll()
    if (!b) return null
    note(b)
    return { kind: 'boon', boonId: b.id, source: 'wildcard' }
  }

  let attunementUsed = false
  const weightedOffer = (): Offer | null => {
    let b: Boon | null = null
    if (attuneTag && !attunementUsed) {
      b = weightedRoll(attuneTag)
      attunementUsed = b !== null
    }
    b = b ?? weightedRoll()
    if (!b) return null
    note(b)
    return { kind: 'boon', boonId: b.id, source: 'weighted' }
  }

  for (const plan of slotPlan(offerSize, elite)) {
    let offer: Offer | null = null
    if (plan === 'held') {
      const belowMax = heldPlain.filter((s) => s.level < MAX_LEVEL)
      if (belowMax.length) {
        const pick = belowMax[Math.floor(random() * belowMax.length)]
        note(boon(pick.boonId))
        offer = { kind: 'boon', boonId: pick.boonId, source: 'held' }
      } else if (heldPlain.length) {
        offer = wildcard() // every held boon is maxed
      } else {
        offer = weightedOffer() // holds no plain boons yet
      }
    } else if (plan === 'weighted') {
      offer = weightedOffer()
    } else {
      offer = wildcard()
    }
    if (offer && !isDuplicate(offers, offer)) offers.push(offer)
  }
  return offers
}

function isDuplicate(offers: Offer[], offer: Offer): boolean {
  return offers.some((o) => JSON.stringify(o) === JSON.stringify(offer))
}

/**
 * Starting Boon upgrade: one random eligible boon at even odds (Banish applies).
 * Returns an empty offer if nothing is eligible.
 */
export function startingOffer(character: DraftCharacter, slots: Slot[], random: Random): Offer[] {
  const held = slots.filter((s): s is SlotContent => s !== null).flatMap(boonsIn)
  const pool = eligibleBoons(character, held)
  if (pool.length === 0) return []
  const b = pool[Math.floor(random() * pool.length)]
  return [{ kind: 'boon', boonId: b.id, source: 'starting' }]
}

/** Hidden offer when a room's condition is met: 2 random Thils's gifts the player doesn't hold. */
export function giftOffer(heldHiddenId: string | null, random: Random, count = 2): string[] {
  const pool = HIDDEN_BOONS.filter((h) => h.kind === 'gift' && h.id !== heldHiddenId).map((h) => h.id)
  const picked: string[] = []
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0])
  }
  return picked
}

/** The class trigger's hidden boon for a class, if any. */
export function classHiddenBoon(classId: string): string | null {
  return HIDDEN_BOONS.find((h) => h.kind === 'class' && h.classId === classId)?.id ?? null
}
