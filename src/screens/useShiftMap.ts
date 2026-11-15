// Hook for triggering a boss arena's Shift Action (e.g. Marching Columns or
// Fold Space). Keeps the map shift and any mirrored player/summon token moves
// together.
import type { RunState } from '../model/run'
import { shiftEffectOf } from '../rules/battleMap'
import { shiftMap } from '../rules/roomFlow'
import type { Room } from '../rules/rooms'
import { moveToken, roomKeyOf, useTokens } from '../runStore'
import { mirroredTokenSpots, playerPieces, useLooks } from './mapPieces'

type Step = (s: RunState) => RunState
type Act = (step: Step, confirmText?: string) => void

/**
 * Returns a trigger function for the current boss arena's shift effect, or null
 * when the room has none.
 */
export function useShiftMap(state: RunState, room: Room, act: Act): (() => void) | null {
  const tokens = useTokens(state.run.id)
  const looks = useLooks()
  const map = room.map ?? null
  const effect = shiftEffectOf(room.boss?.id ?? map?.arena)
  if (!map || !effect) return null

  const roomKey = roomKeyOf(room)
  return () => {
    act((s) => shiftMap(s))
    if (effect.kind === 'mirror') {
      const pieces = playerPieces(state.players, looks, map, tokens, roomKey, () => true, () => false)
      for (const { characterId, spot } of mirroredTokenSpots(pieces, map.squares)) {
        moveToken(state.run.id, characterId, spot, roomKey).catch((e) => console.error('Could not move the token', e))
      }
    }
  }
}
