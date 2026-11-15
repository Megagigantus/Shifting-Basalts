// Hook for triggering a boss arena's Shift Action or Bloodied map effect
// (e.g. Marching Columns, Fold Space, Acoustic Shift, Tilt the Gate, or
// Gravitational Pulse). Keeps the map update, optional save picker, and any
// player/summon token moves together.
import { createElement, useState, type ReactNode } from 'react'
import type { RunState } from '../model/run'
import { bloodiedEffectOf, mapPhase, shiftEffectOf, type ShiftEffect } from '../rules/battleMap'
import { bossOf } from '../rules/bosses'
import { bossBloodied } from '../rules/hp'
import { applyMapEffect, shiftMap } from '../rules/roomFlow'
import type { Room } from '../rules/rooms'
import { planShift, type Direction, type ShiftPlan, type TokenPos } from '../rules/shiftEffects'
import { moveToken, roomKeyOf, useTokens, type TokenSpot } from '../runStore'
import type { BoardPiece } from './BattleBoard'
import { playerPieces, tokenOwner, useLooks } from './mapPieces'
import { ShiftNotes, ShiftSavePicker } from './ShiftSavePicker'

type Step = (s: RunState) => RunState
type Act = (step: Step, confirmText?: string) => void

interface PendingShift {
  plan: ShiftPlan
  pieces: BoardPiece[]
  tokenPos: TokenPos[]
  phase: number
}

export interface ShiftMapControl {
  effect: ShiftEffect
  label: string
  trigger: () => void
  picker: ReactNode
}

/**
 * Returns the map effect control (effect, button label, trigger, and save
 * picker) for the current boss arena's shift or bloodied effect, or null when
 * the room has none (or is not in phase 2 for a bloodied effect).
 */
export function useMapEffect(
  state: RunState,
  room: Room,
  act: Act,
  which: 'shift' | 'bloodied',
): ShiftMapControl | null {
  const tokens = useTokens(state.run.id)
  const looks = useLooks()
  const [pending, setPending] = useState<PendingShift | null>(null)
  // Notes from a shift that applied without a save (e.g. someone crushed by the walls).
  const [shownNotes, setShownNotes] = useState<string[] | null>(null)
  const map = room.map ?? null
  const bossId = room.boss?.id ?? map?.arena
  const ctx = { partyLevel: state.run.partyLevel, pressures: state.run.pressures }
  const phase = map ? mapPhase(map, bossBloodied(room, ctx)) : 1
  const effect = which === 'shift' ? shiftEffectOf(bossId) : bloodiedEffectOf(bossId)
  if (!map || !effect) return null
  if (which === 'bloodied' && phase !== 2) return null

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
    act((s) => (which === 'shift' ? shiftMap(s, plan.map) : applyMapEffect(s, plan.map)))
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
    const plan = planShift(map, effect, tokenPos, { phase, random: Math.random })
    if (plan.save && plan.save.keys.length > 0) {
      setPending({ plan, pieces, tokenPos, phase })
    } else {
      apply(plan, pieces)
      if (plan.notes.length) setShownNotes(plan.notes.map((n) => n.replace(/\b(?:pc|sm):[^\s]+/g, (k) => labelForKey(k, pieces))))
    }
  }

  function labelForKey(key: string, pieces: BoardPiece[]): string {
    const id = tokenOwner(key)
    const player = state.players.find((p) => p.characterId === id)
    if (key.startsWith('sm:')) return `${player?.name ?? id ?? key}'s summon`
    return player?.name ?? pieces.find((p) => p.key === key)?.label ?? key
  }

  function handleDirectionChange(dir: Direction) {
    if (!pending || !map || !effect) return
    const nextPlan = planShift(map, effect, pending.tokenPos, {
      phase: pending.phase,
      random: Math.random,
      direction: dir,
    })
    setPending({ ...pending, plan: nextPlan })
  }

  const picker =
    pending && pending.plan.save
      ? createElement(ShiftSavePicker, {
          title: which === 'shift' ? (shiftActionName ?? label) : label,
          saveLabel: pending.plan.save.label,
          targets: pending.plan.save.keys.map((key) => ({ key, label: labelForKey(key, pending.pieces) })),
          notes: pending.plan.notes.map((n) =>
            n.replace(/\b(?:pc|sm):[^\s]+/g, (k) => labelForKey(k, pending.pieces)),
          ),
          direction: pending.plan.direction,
          onDirectionChange: handleDirectionChange,
          onApply: (failedKeys: Set<string>) => {
            const current = pending
            setPending(null)
            // Re-plan so only the tokens that failed move; the rest stay put and block.
            const finalPlan = planShift(map, effect, current.tokenPos, {
              phase: current.phase,
              random: Math.random,
              direction: current.plan.direction,
              only: failedKeys,
            })
            apply(finalPlan, current.pieces, failedKeys)
          },
          onCancel: () => setPending(null),
        })
      : shownNotes
        ? createElement(ShiftNotes, { title: label, notes: shownNotes, onClose: () => setShownNotes(null) })
        : null

  return { effect, label, trigger, picker }
}

/**
 * Returns the shift control (effect, button label, trigger, and save picker)
 * for the current boss arena's shift effect, or null when the room has none.
 */
export function useShiftMap(state: RunState, room: Room, act: Act): ShiftMapControl | null {
  return useMapEffect(state, room, act, 'shift')
}
