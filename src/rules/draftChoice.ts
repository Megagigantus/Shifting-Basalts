// A draft choice as plain data, so a player's device can send it and the DM's
// app can apply it with the same rules (rules/draftFlow.ts).
import type { RunPlayer, RunState } from '../model/run'
import type { Random } from './draft'
import { chooseHidden, chooseOffer, passDraft, passHidden, rerollDraft } from './draftFlow'
import { spendForge, type ForgeAction } from './forge'
import { chooseRelic, passVault } from './vault'
import { recover, refundPayoff, spendPayoff } from './recovery'
import { chooseReprieve } from './reprieve'
import { spendFortuneDie } from './fortune'
import { shrineOffering } from './loot'

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
  /** Pass Thils's Vault (when already owning a relic) for Quantum Basalts. */
  | { action: 'relicPass' }
  /** Spend recovery points on a track preset (a spell slot or class resource). */
  | { action: 'recover'; track: string; presetId: string }
  /** Spend 1 recovery point on a held recovery payoff boon (Leyline Surge, Momentum). */
  | { action: 'payoffSpend'; boonId: string }
  /** Level 3 recovery payoff refund (+1 point to its track). */
  | { action: 'payoffRefund'; boonId: string }
  /** Use (or lose) one Fortune Die: a reroll or a failed Gleam Dealer's Gamble stake. */
  | { action: 'fortuneUse' }
  /** Reprieve: Rest (recorded; applied at the table). */
  | { action: 'reprieveRest' }
  /** Reprieve: Reflect, leveling up the boon in this slot. */
  | { action: 'reprieveReflect'; slotIndex: number }
  /** Reprieve: catch-up Basalts, for a player with no boon to level. */
  | { action: 'reprieveBasalts' }
  /** Shrine to Thils: offer a trinket from the party's loot to reroll one floor roll. */
  | { action: 'shrineOffering'; trinketUid: string; targetUid: string }
  /** Shrine to Thils: wake a Dormant relic with banked Quantum Basalts. */
  | { action: 'wakeRelic'; relicId: string }

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
    case 'relicPass':
      return passVault(state, characterId)
    case 'recover':
      return recover(state, characterId, choice.track, choice.presetId)
    case 'payoffSpend':
      return spendPayoff(state, characterId, choice.boonId)
    case 'payoffRefund':
      return refundPayoff(state, characterId, choice.boonId)
    case 'fortuneUse':
      return spendFortuneDie(state, characterId)
    case 'reprieveRest':
      return chooseReprieve(state, characterId, { kind: 'rest' })
    case 'reprieveReflect':
      return chooseReprieve(state, characterId, { kind: 'reflect', slotIndex: choice.slotIndex })
    case 'reprieveBasalts':
      return chooseReprieve(state, characterId, { kind: 'basalts' })
    case 'shrineOffering': {
      const player = state.players.find((p) => p.characterId === characterId)
      if (!player || !player.alive) throw new Error('Only a living player can make an offering.')
      return shrineOffering(state, choice.trinketUid, choice.targetUid, random)
    }
    case 'wakeRelic':
      // Updates the character's permanent record; runStore.wakeRelicAtShrine does that.
      throw new Error('Waking a relic is applied separately.')
  }
}

/** Choices that answer the current draft offer (others aren't tied to one). */
export function isDraftChoice(choice: DraftChoice): boolean {
  return choice.action === 'take' || choice.action === 'pass' || choice.action === 'reroll'
}
