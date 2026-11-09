// Drafts during a run: opening offers after a room, and each player's
// choice (take, replace, pass, reroll), plus hidden offers. Like runFlow.ts,
// every function returns a new state or throws if the move isn't allowed.
import type { RoomKind, RunPlayer, RunState } from '../model/run'
import { combine, evolve, replaceBoon, takeBoon, type Slot } from './boons'
import { classHiddenBoon, generateOffer, giftOffer, startingOffer, type DraftCharacter, type Random } from './draft'
import { pass, setHiddenBoon } from './runFlow'

/** Offer size for the run's Pressures: 4, 3 under Narrow Seam, 2 under Narrow Seam II. */
export function offerSize(pressures: string[]): number {
  if (pressures.includes('narrow-seam-2')) return 2
  if (pressures.includes('narrow-seam')) return 3
  return 4
}

function profileOf(p: RunPlayer): DraftCharacter {
  if (!p.draftProfile) throw new Error(`${p.name} has no draft details; start a new run.`)
  return p.draftProfile
}

function buildOffer(state: RunState, p: RunPlayer, elite: boolean, random: Random) {
  const first = (p.draftsSeen ?? 0) === 0
  return generateOffer({
    character: profileOf(p),
    slots: p.slots ?? [],
    offerSize: offerSize(state.run.pressures),
    elite,
    attuneTag: first ? (p.draftProfile?.attuneTag ?? null) : null,
    random,
  })
}

/**
 * Open a draft for every living player after a room clear. `kind` is the
 * room just cleared; Reprieve rooms have no draft (Build clarification 6).
 * Call this on the state returned by clearRoom / defeatBoss.
 */
export function openDrafts(state: RunState, kind: RoomKind, random: Random): RunState {
  // No draft after a Reprieve, or once the run has ended (a full clear).
  if (kind === 'reprieve' || state.run.status !== 'active') return state
  const last = state.run.log.at(-1)
  const elite = kind === 'elite'
  return {
    ...state,
    players: state.players.map((p) => {
      if (!p.alive) return p
      return {
        ...p,
        draft: {
          floor: last?.floor ?? state.run.floor,
          room: last?.room ?? state.run.room,
          elite,
          offers: buildOffer(state, p, elite, random),
        },
        draftsSeen: (p.draftsSeen ?? 0) + 1,
      }
    }),
  }
}

function updateOne(state: RunState, characterId: string, change: (p: RunPlayer) => RunPlayer): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.characterId !== characterId) return p
      if (!p.alive) throw new Error(`${p.name} has fallen.`)
      return change(p)
    }),
  }
}

function requireDraft(p: RunPlayer) {
  if (!p.draft) throw new Error(`${p.name} has no draft to choose from.`)
  return p.draft
}

/**
 * Take offer `index`. A boon goes in an empty slot (or levels up if held);
 * if every slot is full, `replaceSlot` says which slot to drop. A wildcard
 * Evolution or Combination is applied in place.
 */
export function chooseOffer(state: RunState, characterId: string, index: number, replaceSlot?: number): RunState {
  return updateOne(state, characterId, (p) => {
    const draft = requireDraft(p)
    const offer = draft.offers[index]
    if (!offer) throw new Error('That offer doesn\'t exist.')
    const slots: Slot[] = p.slots ?? []
    let next: Slot[]
    if (offer.kind === 'evolution') next = evolve(slots, offer.slotIndex)
    else if (offer.kind === 'combination') next = combine(slots, offer.combinationId)
    else if (replaceSlot !== undefined) next = replaceBoon(slots, replaceSlot, offer.boonId)
    else next = takeBoon(slots, offer.boonId)
    return { ...p, slots: next, draft: null }
  })
}

/** Skip this draft for a pass's Quantum Basalts. */
export function passDraft(state: RunState, characterId: string): RunState {
  const player = state.players.find((p) => p.characterId === characterId)
  if (player) requireDraft(player)
  const passed = pass(state, characterId)
  return updateOne(passed, characterId, (p) => ({ ...p, draft: null }))
}

/** Rerolls this player has left on the current floor. */
export function rerollsLeft(p: RunPlayer, floor: number): number {
  const allowed = p.draftProfile?.rerollsPerFloor ?? 0
  const used = p.rerolls?.floor === floor ? p.rerolls.used : 0
  return Math.max(0, allowed - used)
}

/** Replace the whole offer with a fresh one, using one of this floor's rerolls. */
export function rerollDraft(state: RunState, characterId: string, random: Random): RunState {
  const floor = state.run.floor
  return updateOne(state, characterId, (p) => {
    const draft = requireDraft(p)
    if (rerollsLeft(p, floor) < 1) throw new Error('No rerolls left on this floor.')
    const used = p.rerolls?.floor === floor ? p.rerolls.used : 0
    // Attunement only shapes the very first offer, so rerolls don't repeat it.
    const rerolled = { ...p, draftsSeen: Math.max(1, p.draftsSeen ?? 1) }
    return {
      ...rerolled,
      draft: {
        ...draft,
        offers: draft.starting
          ? startingOffer(profileOf(p), p.slots ?? [], random)
          : buildOffer(state, rerolled, draft.elite, random),
      },
      rerolls: { floor, used: used + 1 },
    }
  })
}

/**
 * Starting Boon: at the start of floor 1, room 1, each owner is offered one
 * random boon at Level 1. Call this on a fresh run, before the first room.
 */
export function openStartingBoons(state: RunState, owners: string[], random: Random): RunState {
  return {
    ...state,
    players: state.players.map((p) => {
      if (!p.alive || !owners.includes(p.characterId)) return p
      const offers = startingOffer(profileOf(p), p.slots ?? [], random)
      if (offers.length === 0) return p
      return { ...p, draft: { floor: 1, room: 0, elite: false, offers, starting: true } }
    }),
  }
}

/** The room's secret condition was met: every living player gets 2 random gifts. */
export function roomConditionMet(state: RunState, random: Random): RunState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.alive
        ? {
            ...p,
            hiddenOffer: {
              gifts: giftOffer(p.hiddenBoonId ?? null, random),
              classBoon: p.hiddenOffer?.classBoon ?? null,
            },
          }
        : p,
    ),
  }
}

/** A player met their class trigger: offer their class's hidden boon. */
export function classTriggerMet(state: RunState, characterId: string): RunState {
  return updateOne(state, characterId, (p) => {
    const classBoon = classHiddenBoon(profileOf(p).classId)
    if (!classBoon) throw new Error('This class has no hidden boon.')
    if (p.hiddenBoonId === classBoon) throw new Error(`${p.name} already holds it.`)
    return { ...p, hiddenOffer: { gifts: p.hiddenOffer?.gifts ?? [], classBoon } }
  })
}

/** Take one of the hidden offer's boons (replacing any held hidden boon). */
export function chooseHidden(state: RunState, characterId: string, hiddenBoonId: string): RunState {
  const player = state.players.find((p) => p.characterId === characterId)
  const offer = player?.hiddenOffer
  if (!offer) throw new Error('No hidden offer to choose from.')
  if (!offer.gifts.includes(hiddenBoonId) && offer.classBoon !== hiddenBoonId) {
    throw new Error('That isn\'t in the hidden offer.')
  }
  const taken = setHiddenBoon(state, characterId, hiddenBoonId)
  return updateOne(taken, characterId, (p) => ({ ...p, hiddenOffer: null }))
}

/** Turn down the hidden offer for the normal Pass bonus. */
export function passHidden(state: RunState, characterId: string): RunState {
  const player = state.players.find((p) => p.characterId === characterId)
  if (!player?.hiddenOffer) throw new Error('No hidden offer to pass on.')
  const passed = pass(state, characterId)
  return updateOne(passed, characterId, (p) => ({ ...p, hiddenOffer: null }))
}
