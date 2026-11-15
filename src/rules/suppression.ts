// Boon suppression rules (design bible, The Inverted Reliquary: Slot Scramble).
// Pure functions that pick and apply random plain-boon suppressions per
// living player.
import type { RunPlayer, RunState } from '../model/run'
import { setSuppressed, slotName, type Slot } from './boons'
import { changeSlots } from './runFlow'

export interface SuppressPick {
  characterId: string
  slotIndex: number
  name: string
}

/** Indexes of slots that hold a plain, unsuppressed boon. */
export function eligibleSuppressSlots(slots: Slot[] | undefined): number[] {
  const out: number[] = []
  if (!slots) return out
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    if (slot?.kind === 'boon' && !slot.suppressed) out.push(i)
  }
  return out
}

/**
 * Pick up to `count` distinct plain-boon slots per living player (including
 * vanished players). Players with no eligible slot produce no picks.
 */
export function planBoonSuppression(
  players: RunPlayer[],
  count: number,
  random: () => number,
): SuppressPick[] {
  const picks: SuppressPick[] = []
  for (const player of players) {
    if (!player.alive) continue
    const slots = player.slots
    if (!slots) continue
    const candidates = eligibleSuppressSlots(slots)
    for (let k = 0; k < count && candidates.length > 0; k++) {
      const pickAt = Math.floor(random() * candidates.length)
      const [slotIndex] = candidates.splice(pickAt, 1)
      const slot = slots[slotIndex]
      if (!slot) continue
      picks.push({
        characterId: player.characterId,
        slotIndex,
        name: slotName(slot),
      })
    }
  }
  return picks
}

/**
 * Mark picked slots as suppressed, skipping any stale picks silently (slot
 * missing, no longer a plain boon, already suppressed, player fallen/absent,
 * or run not active). Never mutates the input state.
 */
export function applyBoonSuppression(state: RunState, picks: SuppressPick[]): RunState {
  if (state.run.status !== 'active') return state
  let next = state
  for (const pick of picks) {
    const player = next.players.find((p) => p.characterId === pick.characterId)
    if (!player || !player.alive) continue
    const slot = player.slots?.[pick.slotIndex]
    if (!slot || slot.kind !== 'boon' || slot.suppressed) continue
    next = changeSlots(next, pick.characterId, (slots) => setSuppressed(slots, pick.slotIndex, true))
  }
  return next
}
