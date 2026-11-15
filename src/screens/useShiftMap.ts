// Hook for triggering a boss arena's Shift Action (e.g. Marching Columns or
// Fold Space). Keeps the map shift, optional save picker, and any
// player/summon token moves together.
import { createElement, useState, type ReactNode } from 'react'
import type { RunState } from '../model/run'
import { mapPhase, shiftEffectOf, type ShiftEffect } from '../rules/battleMap'
import { bossOf } from '../rules/bosses'
import { bossBloodied } from '../rules/hp'
import { shiftMap } from '../rules/roomFlow'
import type { Room } from '../rules/rooms'
import { planShift, type ShiftPlan, type TokenPos } from '../rules/shiftEffects'
import { moveToken, roomKeyOf, useTokens, type TokenSpot } from '../runStore'
import type { BoardPiece } from './BattleBoard'
import { playerPieces, tokenOwner, useLooks } from './mapPieces'
import { ShiftSavePicker } from './ShiftSavePicker'

type Step = (s: RunState) => RunState
type Act = (step: Step, confirmText?: string) => void

interface PendingShift {
  plan: ShiftPlan
  pieces: BoardPiece[]
}

export interface ShiftMapControl {
  effect: ShiftEffect
  label: string
  trigger: () => void
  picker: ReactNode
}

/**
 * Returns the shift control (effect, button label, trigger, and save picker)
 * for the current boss arena's shift effect, or null when the room has none.
 */
export function useShiftMap(state: RunState, room: Room, act: Act): ShiftMapControl | null {
  const tokens = useTokens(state.run.id)
  const looks = useLooks()
  const [pending, setPending] = useState<PendingShift | null>(null)
  const map = room.map ?? null
  const bossId = room.boss?.id ?? map?.arena
  const effect = shiftEffectOf(bossId)
  if (!map || !effect) return null

  const customLabel: string | undefined = effect.label
  const shiftActionName = bossId ? bossOf(bossId)?.shiftAction.name : undefined
  const label =
    effect.kind === 'march'
      ? map.pieces.some((p) => p.key.startsWith('march:'))
        ? 'March 15 ft'
        : 'Raise Marching Columns'
      : effect.kind === 'mirror'
        ? 'Fold Space'
        : customLabel ?? shiftActionName ?? 'Shift'

  const roomKey = roomKeyOf(room)

  function apply(plan: ShiftPlan, pieces: BoardPiece[], failedKeys?: Set<string>) {
    act((s) => shiftMap(s, plan.map))
    const moves = failedKeys ? plan.moves.filter((m) => failedKeys.has(m.key)) : plan.moves
    if (!moves.length) return
    const moveByKey = new Map(moves.map((m) => [m.key, m]))
    const charIds = new Set(moves.map((m) => tokenOwner(m.key)).filter((id): id is string => Boolean(id)))
    for (const characterId of charIds) {
      const pc = pieces.find((p) => p.key === `pc:${characterId}`)
      const sm = pieces.find((p) => p.key === `sm:${characterId}`)
      const pcMove = moveByKey.get(`pc:${characterId}`)
      const smMove = moveByKey.get(`sm:${characterId}`)
      const x = pcMove ? pcMove.x : (pc?.x ?? 0)
      const y = pcMove ? pcMove.y : (pc?.y ?? 0)
      const spot: Omit<TokenSpot, 'roomKey'> =
        sm || smMove
          ? {
              x,
              y,
              sx: smMove ? smMove.x : (sm?.x ?? 0),
              sy: smMove ? smMove.y : (sm?.y ?? 0),
            }
          : { x, y }
      moveToken(state.run.id, characterId, spot, roomKey).catch((e) => console.error('Could not move the token', e))
    }
  }

  function trigger() {
    if (!map || !effect) return
    const pieces = playerPieces(state.players, looks, map, tokens, roomKey, () => true, () => false)
    const tokenPos: TokenPos[] = pieces
      .filter((p) => p.key.startsWith('pc:') || p.key.startsWith('sm:'))
      .map((p) => ({ key: p.key, x: p.x, y: p.y }))
    const ctx = { partyLevel: state.run.partyLevel, pressures: state.run.pressures }
    const phase = mapPhase(map, bossBloodied(room, ctx))
    const plan = planShift(map, effect, tokenPos, { phase, random: Math.random })
    if (plan.save && plan.save.keys.length > 0) {
      setPending({ plan, pieces })
    } else {
      apply(plan, pieces)
    }
  }

  function labelForKey(key: string, pieces: BoardPiece[]): string {
    const id = tokenOwner(key)
    const player = state.players.find((p) => p.characterId === id)
    if (key.startsWith('sm:')) return `${player?.name ?? id ?? key}'s summon`
    return player?.name ?? pieces.find((p) => p.key === key)?.label ?? key
  }

  const picker =
    pending && pending.plan.save
      ? createElement(ShiftSavePicker, {
          title: shiftActionName ?? label,
          saveLabel: pending.plan.save.label,
          targets: pending.plan.save.keys.map((key) => ({ key, label: labelForKey(key, pending.pieces) })),
          notes: pending.plan.notes,
          onApply: (failedKeys: Set<string>) => {
            const current = pending
            setPending(null)
            apply(current.plan, current.pieces, failedKeys)
          },
          onCancel: () => setPending(null),
        })
      : null

  return { effect, label, trigger, picker }
}
