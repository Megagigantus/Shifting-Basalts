// Finishing a room, in order: its loot, the clear (Devotions, Basalts), then
// the drafts and the next room. After the legendary boss, Thils's Vault opens
// instead of a draft.
import type { RoomKind, RunState } from '../model/run'
import type { Random } from './draft'
import { openDrafts } from './draftFlow'
import { bossCache, roomLoot } from './loot'
import { enterRoom } from './roomFlow'
import { clearRoom, defeatBoss, isFullClear } from './runFlow'
import { openVault } from './vault'
import { refreshRecovery } from './recovery'
import { reprieveWaitingOn } from './reprieve'
import { returnVanished } from './lostAndFound'

export function finishRoom(
  state: RunState,
  kind: RoomKind,
  random: Random,
  options: { refreshRecovery?: boolean } = {},
): RunState {
  const refresh = options.refreshRecovery === false ? (s: RunState) => s : refreshRecovery
  if (kind === 'boss') {
    const bossId = state.dm?.room?.boss?.id ?? state.dm?.bossId ?? null
    const beaten = refresh(defeatBoss(bossCache(state, bossId, random)))
    // Lost and Found: anyone in the maze reappears in the post-boss room,
    // after the boss's draft (which they missed).
    if (isFullClear(beaten)) return enterRoom(openVault(returnVanished(beaten), random), random)
    return enterRoom(returnVanished(openDrafts(beaten, 'boss', random)), random)
  }
  // Everyone chooses Rest or Reflect before the party leaves a Reprieve.
  const resting = kind === 'reprieve' ? reprieveWaitingOn(state) : []
  if (resting.length) throw new Error(`Waiting on Reprieve choices from ${resting.join(', ')}.`)
  // A Reprieve pays no Devotion, so it brings no recovery points either.
  const looted = clearRoom(roomLoot(state, kind, random), kind)
  const cleared = kind === 'reprieve' ? looted : refresh(looted)
  return enterRoom(returnVanished(openDrafts(cleared, kind, random)), random)
}
