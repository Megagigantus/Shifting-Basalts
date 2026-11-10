// A draft choice as plain data, so a player's device can send it and the DM's
// app can apply it with the same rules (rules/draftFlow.ts).
import type { RunPlayer, RunState } from '../model/run'
import type { Random } from './draft'
import { chooseHidden, chooseOffer, passDraft, passHidden, rerollDraft } from './draftFlow'
import { spendForge, type ForgeAction } from './forge'
import { chooseRelic } from './vault'

export type DraftChoice =
  | { action: 'take'; index: number; replaceSlot?: number | null }
  | { action: 'pass' }
  | { action: 'reroll' }
  | { action: 'hidden'; hiddenBoonId: string }
  | { action: 'passHidden' }
  | { action: 'forge'; forge: ForgeAction }
  /** Use Hidden Sight on the current room (the hint goes to a private document). */
  | { action: 'hiddenSight' }
  /** Take a relic from Thils's Vault. */
  | { action: 'relic'; relicId: string }

/**
 * Identifies the exact offer a choice was made against. If the offer changes
 * (a reroll, the next room) before the choice is applied, the key no longer
 * matches and the stale choice is refused.
 */
export function draftKey(p: RunPlayer): string | null {
  if (!p.draft) return null
  return `${p.draft.floor}-${p.draft.room}-${p.draftsSeen ?? 0}-${p.rerolls?.used ?? 0}`
}

/** Apply one player's choice to the run, or throw if it isn't allowed. */
export function applyChoice(state: RunState, characterId: string, choice: DraftChoice, random: Random): RunState {
  switch (choice.action) {
    case 'take':
      return chooseOffer(state, characterId, choice.index, choice.replaceSlot ?? undefined)
    case 'pass':
      return passDraft(state, characterId)
    case 'reroll':
      return rerollDraft(state, characterId, random)
    case 'hidden':
      return chooseHidden(state, characterId, choice.hiddenBoonId)
    case 'passHidden':
      return passHidden(state, characterId)
    case 'forge':
      return spendForge(state, characterId, choice.forge)
    case 'hiddenSight':
      // Needs to write the hint privately; runStore.applyHiddenSight does that.
      throw new Error('Hidden Sight is applied separately.')
    case 'relic':
      return chooseRelic(state, characterId, choice.relicId)
  }
}

/** Choices that answer the current draft offer (others aren't tied to one). */
export function isDraftChoice(choice: DraftChoice): boolean {
  return choice.action === 'take' || choice.action === 'pass' || choice.action === 'reroll'
}
