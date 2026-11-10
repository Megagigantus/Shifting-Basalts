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

export function finishRoom(state: RunState, kind: RoomKind, random: Random): RunState {
  if (kind === 'boss') {
    const bossId = state.dm?.room?.boss?.id ?? state.dm?.bossId ?? null
    const beaten = defeatBoss(bossCache(state, bossId, random))
    if (isFullClear(beaten)) return enterRoom(openVault(beaten, random), random)
    return enterRoom(openDrafts(beaten, 'boss', random), random)
  }
  const cleared = clearRoom(roomLoot(state, kind, random), kind)
  return enterRoom(openDrafts(cleared, kind, random), random)
}
