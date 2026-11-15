import { describe, expect, it } from 'vitest'
import { placeArena, shiftEffectOf, type BattleMap } from './battleMap'
import type { Room } from './rooms'
import { blockedSquares, planShift, slideToken, type TokenPos } from './shiftEffects'

describe('shiftEffects', () => {
  describe('slideToken', () => {
    it('moves the full distance when the path is clear', () => {
      const res = slideToken({ x: 5, y: 5 }, 0, 1, 3, 14, new Set())
      expect(res).toEqual({ x: 5, y: 8, stoppedBy: null })
    })

    it('stops at the grid edge', () => {
      expect(slideToken({ x: 1, y: 5 }, -1, 0, 3, 14, new Set())).toEqual({
        x: 0,
        y: 5,
        stoppedBy: 'edge',
      })
      expect(slideToken({ x: 5, y: 12 }, 0, 1, 3, 14, new Set())).toEqual({
        x: 5,
        y: 13,
        stoppedBy: 'edge',
      })
    })

    it('stops before a blocked square', () => {
      const blocked = new Set(['5,7'])
      const res = slideToken({ x: 5, y: 5 }, 0, 1, 3, 14, blocked)
      expect(res).toEqual({ x: 5, y: 6, stoppedBy: 'blocked' })
    })
  })

  describe('blockedSquares', () => {
    it('includes a 2x2 boss token, phase-matched objects, and other tokens, but never areas', () => {
      const map: BattleMap = {
        squares: 14,
        entrance: 'south',
        pieces: [
          { key: 'boss:0', kind: 'boss', id: 'bosses:test', x: 6, y: 3, size: 2, hp: 'boss' },
          { key: 'obj:p1', kind: 'object', id: 'pillar', x: 2, y: 2, size: 1, w: 1, h: 1, phase: 1 },
          { key: 'obj:p2', kind: 'object', id: 'pillar', x: 9, y: 9, size: 1, w: 1, h: 1, phase: 2 },
        ],
        areas: [
          { key: 'area:0', kind: 'strip', name: 'Conveyor strip', x: 4, y: 0, w: 2, h: 14 },
        ],
      }
      const tokens: TokenPos[] = [
        { key: 'pc:a', x: 1, y: 1 },
        { key: 'pc:b', x: 1, y: 2 },
      ]

      const phase1 = blockedSquares(map, 1, tokens, 'pc:a')
      // 2x2 boss token's four squares
      expect(phase1.has('6,3')).toBe(true)
      expect(phase1.has('7,3')).toBe(true)
      expect(phase1.has('6,4')).toBe(true)
      expect(phase1.has('7,4')).toBe(true)
      // Phase-1 object included in phase 1, phase-2 object excluded
      expect(phase1.has('2,2')).toBe(true)
      expect(phase1.has('9,9')).toBe(false)
      // Other token included, ignored token excluded
      expect(phase1.has('1,2')).toBe(true)
      expect(phase1.has('1,1')).toBe(false)
      // Areas never block
      expect(phase1.has('4,0')).toBe(false)
      expect(phase1.has('4,5')).toBe(false)

      const phase2 = blockedSquares(map, 2, tokens)
      expect(phase2.has('2,2')).toBe(false)
      expect(phase2.has('9,9')).toBe(true)
    })
  })

  describe('planShift', () => {
    it('mirror moves a token at y=2 to y=11 on a 14 grid and returns no save', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'blind-architect', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('blind-architect')!
      const tokens: TokenPos[] = [
        { key: 'pc:a', x: 4, y: 2 },
        { key: 'sm:a', x: 8, y: 12 },
      ]

      const plan = planShift(map, effect, tokens, { phase: 1, random: Math.random })
      expect(plan.save).toBeUndefined()
      expect(plan.map.flipped).toBe(true)
      expect(plan.moves).toEqual([
        { key: 'pc:a', x: 4, y: 11 },
        { key: 'sm:a', x: 8, y: 1 },
      ])
    })

    it('march adds 8 march: walls on first call and moves them 3 south on the second, with no moves', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'general-vane', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('general-vane')!
      const tokens: TokenPos[] = [{ key: 'pc:a', x: 5, y: 10 }]

      const first = planShift(map, effect, tokens, { phase: 1, random: Math.random })
      expect(first.save).toBeUndefined()
      expect(first.moves).toEqual([])
      const walls1 = first.map.pieces.filter((p) => p.key.startsWith('march:'))
      expect(walls1).toHaveLength(8)
      expect(walls1.every((w) => w.y === 4)).toBe(true)

      const second = planShift(first.map, effect, tokens, { phase: 1, random: Math.random })
      expect(second.save).toBeUndefined()
      expect(second.moves).toEqual([])
      const walls2 = second.map.pieces.filter((p) => p.key.startsWith('march:'))
      expect(walls2).toHaveLength(8)
      expect(walls2.every((w) => w.y === 7)).toBe(true)
    })
  })
})
