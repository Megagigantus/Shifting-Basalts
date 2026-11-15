import { describe, expect, it } from 'vitest'
import { addObject, bloodiedEffectOf, doorSquares, isFloorObject, placeArena, shiftEffectOf, type BattleMap } from './battleMap'
import type { Room } from './rooms'
import { blockedSquares, planShift, rotateBoxClockwise, slideToken, type TokenPos } from './shiftEffects'

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

    it('skips floor objects such as stride-pool', () => {
      const map: BattleMap = {
        squares: 14,
        entrance: 'south',
        pieces: [
          { key: 'obj:pool', kind: 'object', id: 'stride-pool', x: 4, y: 4, size: 1, w: 1, h: 1 },
          { key: 'obj:pit', kind: 'object', id: 'pit', x: 7, y: 7, size: 1, w: 2, h: 2 },
          { key: 'obj:pillar', kind: 'object', id: 'pillar', x: 2, y: 2, size: 1, w: 1, h: 1 },
        ],
      }
      expect(isFloorObject('stride-pool')).toBe(true)
      expect(isFloorObject('pit')).toBe(true)
      expect(isFloorObject('pillar')).toBe(false)
      const blocked = blockedSquares(map, 1, [])
      expect(blocked.has('4,4')).toBe(false)
      expect(blocked.has('7,7')).toBe(false)
      expect(blocked.has('2,2')).toBe(true)
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

    it('push walls on the Choir arena pushes wall tokens toward center, stops before Pipe cluster 1, and skips interior tokens', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'choir-hollow-column', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('choir-hollow-column')!
      const tokens: TokenPos[] = [
        { key: 'pc:corner', x: 0, y: 0 },
        { key: 'pc:north', x: 6, y: 0 },
        { key: 'pc:mid', x: 6, y: 6 },
      ]

      const plan = planShift(map, effect, tokens, { phase: 1, random: Math.random })
      expect(plan.save).toEqual({
        label: 'Con save',
        keys: ['pc:corner', 'pc:north'],
      })
      expect(plan.moves).toEqual([
        { key: 'pc:corner', x: 3, y: 3 },
        { key: 'pc:north', x: 6, y: 1 },
      ])
      expect(plan.notes).toContain('pc:north stopped early')
    })

    it('push toward boss on the Husk arena in phase 2 pulls everyone 3 squares toward the boss with no save', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'sun-eaters-husk', partySize: 4 } } as Room)!
      const effect = bloodiedEffectOf('sun-eaters-husk')!
      const tokens: TokenPos[] = [{ key: 'pc:a', x: 6, y: 12 }]

      const plan = planShift(map, effect, tokens, { phase: 2, random: Math.random })
      expect(plan.save).toBeUndefined()
      expect(plan.moves).toEqual([{ key: 'pc:a', x: 6, y: 9 }])
    })

    it('tilt on the Stride Core arena slides carried stride-pool objects and tokens, and rolls a direction when omitted', () => {
      const baseMap = placeArena({ kind: 'boss', boss: { id: 'stride-core', partySize: 4 } } as Room)!
      const map = addObject(baseMap, 'stride-pool')
      const poolBefore = map.pieces.find((p) => p.id === 'stride-pool')!
      const effect = shiftEffectOf('stride-core')!
      const tokens: TokenPos[] = [{ key: 'pc:a', x: 12, y: 5 }]

      const planE = planShift(map, effect, tokens, { phase: 1, random: Math.random, direction: 'E' })
      expect(planE.direction).toBe('E')
      expect(planE.save).toEqual({ label: 'Str or Dex save', keys: ['pc:a'] })
      expect(planE.moves).toEqual([{ key: 'pc:a', x: 13, y: 5 }])
      const poolAfter = planE.map.pieces.find((p) => p.id === 'stride-pool')!
      expect(poolAfter.x).toBe(poolBefore.x + 3)
      expect(poolAfter.y).toBe(poolBefore.y)

      const planRolled = planShift(map, effect, tokens, { phase: 1, random: () => 0 })
      expect(planRolled.direction).toBe('N')
    })

    it('conveyor on the Herd arena wraps strip pieces and tokens in opposite directions with no save', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'gilded-excavation-herd', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('gilded-excavation-herd')!
      const tokens: TokenPos[] = [
        { key: 'pc:west', x: 5, y: 1 },
        { key: 'pc:east', x: 8, y: 12 },
        { key: 'pc:mid', x: 7, y: 7 },
      ]

      const plan = planShift(map, effect, tokens, { phase: 1, random: Math.random })
      expect(plan.save).toBeUndefined()
      const hound1 = plan.map.pieces.find((p) => p.name === 'Survey Hound 1')!
      const hound2 = plan.map.pieces.find((p) => p.name === 'Survey Hound 2')!
      const golem = plan.map.pieces.find((p) => p.name === 'Survey Golem')!
      expect(hound1).toMatchObject({ x: 4, y: 0 })
      expect(hound2).toMatchObject({ x: 9, y: 8 })
      expect(golem).toMatchObject({ x: 6, y: 3 })
      expect(plan.moves).toEqual([
        { key: 'pc:west', x: 5, y: 11 },
        { key: 'pc:east', x: 8, y: 2 },
      ])
    })

    it('march on Vane arena shoves caught tokens south of the walls and notes crushed tokens at row 13', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'general-vane', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('general-vane')!

      const first = planShift(map, effect, [{ key: 'pc:a', x: 5, y: 4 }], { phase: 1, random: Math.random })
      expect(first.save).toBeUndefined()
      expect(first.moves).toEqual([{ key: 'pc:a', x: 5, y: 5 }])

      const second = planShift(
        first.map,
        effect,
        [
          { key: 'pc:caught', x: 6, y: 6 },
          { key: 'pc:outside', x: 2, y: 6 },
        ],
        { phase: 1, random: Math.random },
      )
      expect(second.save).toBeUndefined()
      expect(second.moves).toEqual([{ key: 'pc:caught', x: 6, y: 8 }])

      const third = planShift(second.map, effect, [], { phase: 1, random: Math.random })
      const fourth = planShift(third.map, effect, [], { phase: 1, random: Math.random })
      const wallsAtSouth = fourth.map.pieces.filter((p) => p.key.startsWith('march:'))
      expect(wallsAtSouth.every((w) => w.y === 13)).toBe(true)

      const crushed = planShift(fourth.map, effect, [{ key: 'pc:crushed', x: 5, y: 13 }], {
        phase: 1,
        random: Math.random,
      })
      expect(crushed.moves).toEqual([])
      expect(crushed.notes).toContain('pc:crushed is crushed against the south wall')
    })

    it('rotate on Kaelen and Vyr arena rotates edge tokens, drops afterimage:1 then afterimage:2, and leaves ledges unchanged', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'kaelen-and-vyr', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('kaelen-and-vyr')!
      const tokens: TokenPos[] = [
        { key: 'pc:nw', x: 0, y: 0 },
        { key: 'pc:south', x: 5, y: 13 },
        { key: 'pc:mid', x: 6, y: 6 },
      ]

      const first = planShift(map, effect, tokens, { phase: 1, random: Math.random })
      expect(first.save).toBeUndefined()
      expect(first.notes).toEqual([])
      expect(first.moves).toEqual([
        { key: 'pc:nw', x: 13, y: 0 },
        { key: 'pc:south', x: 0, y: 5 },
      ])
      expect(first.map.pieces.filter((p) => p.key.startsWith('afterimage:'))).toEqual([
        {
          key: 'afterimage:1',
          kind: 'object',
          id: 'afterimage',
          x: 6,
          y: 5,
          size: 1,
          w: 1,
          h: 1,
          name: 'Crystal afterimage',
        },
      ])
      expect(first.map.areas).toEqual(map.areas)

      const second = planShift(first.map, effect, [], { phase: 1, random: Math.random })
      expect(second.save).toBeUndefined()
      expect(second.notes).toEqual([])
      expect(second.map.pieces.find((p) => p.key === 'afterimage:1')).toBeDefined()
      expect(second.map.pieces.find((p) => p.key === 'afterimage:2')).toEqual({
        key: 'afterimage:2',
        kind: 'object',
        id: 'afterimage',
        x: 6,
        y: 5,
        size: 1,
        w: 1,
        h: 1,
        name: 'Crystal afterimage',
      })
      expect(second.map.areas).toEqual(map.areas)
    })

    it('rotate carries wall-edge objects (swapping w/h) and skips exit pieces and interior objects', () => {
      const base = placeArena({ kind: 'boss', boss: { id: 'kaelen-and-vyr', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('kaelen-and-vyr')!
      const map: BattleMap = {
        ...base,
        pieces: [
          ...base.pieces,
          { key: 'exit:1', kind: 'exit', id: '1', x: 6, y: 0, size: 1 },
          { key: 'obj:wall', kind: 'object', id: 'wall-segment', x: 2, y: 0, size: 1, w: 2, h: 1, name: 'Wall segment' },
        ],
      }

      const plan = planShift(map, effect, [], { phase: 1, random: Math.random })
      expect(plan.map.pieces.find((p) => p.key === 'exit:1')).toMatchObject({ x: 6, y: 0 })
      expect(plan.map.pieces.find((p) => p.key === 'obj:wall')).toMatchObject({ x: 13, y: 2, w: 1, h: 2 })
      expect(plan.map.pieces.find((p) => p.key === 'obj:0')).toMatchObject({ x: 4, y: 8 })
    })

    it('gravity on the Chorus arena picks the nearest wall to the anchor, ties N/E/S/W, slides tokens, and leaves bosses put', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'chorus-unseen-angles', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('chorus-unseen-angles')!

      const defaultPlan = planShift(map, effect, [{ key: 'pc:a', x: 4, y: 8 }], {
        phase: 1,
        random: Math.random,
      })
      expect(defaultPlan.save).toBeUndefined()
      expect(defaultPlan.anchors).toEqual([
        { key: 'boss:0', label: 'The Chorus of Unseen Angles' },
        { key: 'boss:1', label: 'Unseen Angle 1' },
        { key: 'boss:2', label: 'Unseen Angle 2' },
        { key: 'boss:3', label: 'Unseen Angle 3' },
      ])
      expect(defaultPlan.anchor).toBe('boss:0')
      expect(defaultPlan.direction).toBe('N')
      expect(defaultPlan.moves).toEqual([{ key: 'pc:a', x: 4, y: 4 }])
      expect(defaultPlan.map.pieces).toEqual(map.pieces)

      const northPlan = planShift(
        map,
        effect,
        [
          { key: 'pc:a', x: 4, y: 8 },
          { key: 'pc:edge', x: 5, y: 0 },
        ],
        { phase: 1, random: Math.random, anchor: 'boss:1' },
      )
      expect(northPlan.anchor).toBe('boss:1')
      expect(northPlan.direction).toBe('N')
      expect(northPlan.moves).toEqual([{ key: 'pc:a', x: 4, y: 4 }])
      expect(northPlan.notes).toContain('pc:edge stopped early')
      expect(northPlan.map.pieces).toEqual(map.pieces)

      const eastPlan = planShift(map, effect, [{ key: 'pc:a', x: 4, y: 8 }], {
        phase: 1,
        random: Math.random,
        anchor: 'boss:3',
      })
      expect(eastPlan.anchor).toBe('boss:3')
      expect(eastPlan.direction).toBe('E')
      expect(eastPlan.moves).toEqual([{ key: 'pc:a', x: 8, y: 8 }])
      expect(eastPlan.map.pieces).toEqual(map.pieces)

      const overridePlan = planShift(map, effect, [{ key: 'pc:a', x: 4, y: 8 }], {
        phase: 1,
        random: Math.random,
        anchor: 'boss:3',
        direction: 'W',
      })
      expect(overridePlan.anchor).toBe('boss:3')
      expect(overridePlan.anchors).toHaveLength(4)
      expect(overridePlan.direction).toBe('W')
      expect(overridePlan.moves).toEqual([{ key: 'pc:a', x: 0, y: 8 }])
    })

    it('gravity handles missing boss pieces and honours ctx.only', () => {
      const emptyMap: BattleMap = { squares: 14, entrance: 'south', pieces: [] }
      const effect = shiftEffectOf('chorus-unseen-angles')!

      const noBossPlan = planShift(emptyMap, effect, [{ key: 'pc:a', x: 4, y: 8 }], {
        phase: 1,
        random: Math.random,
      })
      expect(noBossPlan).toEqual({
        map: emptyMap,
        moves: [],
        notes: ['No Chorus member on the map'],
      })

      const mapWithBoss: BattleMap = {
        squares: 14,
        entrance: 'south',
        pieces: [{ key: 'boss:0', kind: 'boss', id: 'bosses:test', x: 1, y: 6, size: 1, name: 'West Angle' }],
      }
      const onlyPlan = planShift(
        mapWithBoss,
        effect,
        [
          { key: 'pc:front', x: 3, y: 6 },
          { key: 'pc:back', x: 5, y: 6 },
        ],
        { phase: 1, random: Math.random, only: new Set(['pc:back']) },
      )
      expect(onlyPlan.direction).toBe('W')
      expect(onlyPlan.moves).toEqual([{ key: 'pc:back', x: 4, y: 6 }])
      expect(onlyPlan.notes).toContain('pc:back stopped early')
    })

    it('sections on the Warden arena places 3 non-overlapping section areas, replaces them on a second call, and notes tokens on them', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'tessellated-warden', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('tessellated-warden')!

      const first = planShift(map, effect, [], { phase: 1, random: () => 0 })
      expect(first.save).toBeUndefined()
      expect(first.moves).toEqual([])
      const areas = first.map.areas ?? []
      expect(areas).toHaveLength(3)
      expect(areas.map((a) => a.key)).toEqual(['section:0', 'section:1', 'section:2'])

      const validKinds = new Set(effect.kind === 'sections' ? effect.outcomes.map((o) => o.kind) : [])
      const forbidden = blockedSquares(map, 1, [])
      for (const d of doorSquares(map)) forbidden.add(`${d.x},${d.y}`)
      const seenSquares = new Set<string>()

      for (const area of areas) {
        expect(area.w).toBe(2)
        expect(area.h).toBe(2)
        expect(validKinds.has(area.kind)).toBe(true)
        for (let dy = 0; dy < area.h; dy++) {
          for (let dx = 0; dx < area.w; dx++) {
            const sq = `${area.x + dx},${area.y + dy}`
            expect(forbidden.has(sq)).toBe(false)
            expect(seenSquares.has(sq)).toBe(false)
            seenSquares.add(sq)
          }
        }
      }

      const second = planShift(first.map, effect, [], { phase: 1, random: () => 0.9 })
      expect(second.map.areas).toHaveLength(3)
      expect(second.map.areas?.every((a) => a.key.startsWith('section:'))).toBe(true)

      const withTokens = planShift(
        map,
        effect,
        [
          { key: 'pc:on', x: areas[0].x, y: areas[0].y },
          { key: 'pc:door', x: 6, y: 13 },
        ],
        { phase: 1, random: () => 0 },
      )
      expect(withTokens.moves).toEqual([])
      expect(withTokens.notes).toHaveLength(1)
      expect(withTokens.notes[0]).toContain('pc:on')
      expect(withTokens.notes[0]).toContain('Dex save or fall prone')
    })

    it('sections places what fits and adds a note when fewer valid spots remain', () => {
      const tightMap: BattleMap = {
        squares: 4,
        entrance: 'south',
        door: { x: 3, y: 3, w: 1, h: 1 },
        pieces: [
          { key: 'obj:1', kind: 'object', id: 'tall-column', x: 2, y: 0, size: 1, w: 1, h: 1 },
          { key: 'obj:2', kind: 'object', id: 'tall-column', x: 0, y: 2, size: 1, w: 1, h: 1 },
          { key: 'obj:3', kind: 'object', id: 'tall-column', x: 2, y: 2, size: 1, w: 1, h: 1 },
        ],
      }
      const effect = shiftEffectOf('tessellated-warden')!

      const plan = planShift(tightMap, effect, [], { phase: 1, random: () => 0 })
      expect(plan.moves).toEqual([])
      expect(plan.map.areas).toHaveLength(1)
      expect(plan.map.areas?.[0]).toMatchObject({ key: 'section:0', x: 0, y: 0, w: 2, h: 2 })
      expect(plan.notes).toHaveLength(1)
    })

    it('tracks on Halvard Quill arena slides statues to track ends, stops before end-square tokens, and notes path tokens', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'halvard-quill', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('halvard-quill')!

      const plan = planShift(
        map,
        effect,
        [
          { key: 'pc:path', x: 2, y: 7 },
          { key: 'pc:off', x: 0, y: 0 },
        ],
        { phase: 1, random: Math.random },
      )
      expect(plan.save).toBeUndefined()
      expect(plan.moves).toEqual([])
      expect(plan.map.pieces.find((p) => p.key === 'obj:0')).toMatchObject({ x: 2, y: 11 })
      expect(plan.map.pieces.find((p) => p.key === 'obj:1')).toMatchObject({ x: 5, y: 2 })
      expect(plan.notes).toEqual(["pc:path is in a statue's path: PB d8 bludgeoning, Dex save halves"])

      const stoppedByToken = planShift(
        map,
        effect,
        [{ key: 'pc:end', x: 2, y: 11 }],
        { phase: 1, random: Math.random },
      )
      expect(stoppedByToken.moves).toEqual([])
      expect(stoppedByToken.map.pieces.find((p) => p.key === 'obj:0')).toMatchObject({ x: 2, y: 10 })
      expect(stoppedByToken.notes).toEqual(["pc:end is in a statue's path: PB d8 bludgeoning, Dex save halves"])

      const obstructedMap: BattleMap = {
        ...map,
        pieces: [
          ...map.pieces,
          { key: 'obj:blocker', kind: 'object', id: 'tall-column', x: 2, y: 8, size: 1, w: 1, h: 1 },
        ],
      }
      const stoppedByObject = planShift(
        obstructedMap,
        effect,
        [{ key: 'pc:behind', x: 2, y: 9 }],
        { phase: 1, random: Math.random },
      )
      expect(stoppedByObject.map.pieces.find((p) => p.key === 'obj:0')).toMatchObject({ x: 2, y: 7 })
      expect(stoppedByObject.notes).toEqual([])
    })

    it('orbit on Lattice Spinner arena moves all 6 columns clockwise, avoids collisions and boss, and notes sweep and transit cables', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'lattice-spinner', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('lattice-spinner')!

      const beforeCols = map.pieces.filter((p) => p.kind === 'object' && p.id === 'tall-column')
      expect(beforeCols).toHaveLength(6)

      const plan = planShift(
        map,
        effect,
        [
          { key: 'pc:sweep', x: 5, y: 3 },
          { key: 'pc:far', x: 0, y: 0 },
        ],
        { phase: 1, random: Math.random },
      )
      expect(plan.save).toBeUndefined()
      expect(plan.moves).toEqual([])

      const afterCols = plan.map.pieces.filter((p) => p.kind === 'object' && p.id === 'tall-column')
      expect(afterCols).toHaveLength(6)
      const destKeys = new Set(afterCols.map((c) => `${c.x},${c.y}`))
      expect(destKeys.size).toBe(6)

      const boss = plan.map.pieces.find((p) => p.kind === 'boss')!
      const bossSquares = new Set<string>()
      for (let dy = 0; dy < boss.size; dy++) {
        for (let dx = 0; dx < boss.size; dx++) {
          bossSquares.add(`${boss.x + dx},${boss.y + dy}`)
        }
      }

      for (let i = 0; i < beforeCols.length; i++) {
        const prev = beforeCols[i]
        const next = afterCols[i]
        expect(next.x !== prev.x || next.y !== prev.y).toBe(true)
        expect(bossSquares.has(`${next.x},${next.y}`)).toBe(false)
        const dist = Math.hypot(next.x - prev.x, next.y - prev.y)
        expect(dist).toBeGreaterThanOrEqual(1.5)
        expect(dist).toBeLessThanOrEqual(4.5)
      }

      expect(plan.notes).toEqual(["pc:sweep is in a column's sweep: Dex save"])

      const withCable = addObject(map, 'transit-cable')
      const cablePlan = planShift(withCable, effect, [], { phase: 1, random: Math.random })
      expect(cablePlan.notes).toEqual(['Re-place the transit cables on the moved columns'])
    })

    it('orbit falls back to alternate floor/ceil targets or leaves a blocked column in place with a note', () => {
      const effect = shiftEffectOf('lattice-spinner')!
      const fallbackMap: BattleMap = {
        squares: 14,
        entrance: 'south',
        pieces: [{ key: 'obj:0', kind: 'object', id: 'tall-column', x: 4, y: 2, size: 1, w: 1, h: 1, name: 'Tall column' }],
      }
      // Rounded target for (4, 2) is (7, 1); blocking (7, 1) should fall back to another floor/ceil corner.
      const fallbackPlan = planShift(
        fallbackMap,
        effect,
        [{ key: 'pc:block', x: 7, y: 1 }],
        { phase: 1, random: Math.random },
      )
      const movedCol = fallbackPlan.map.pieces.find((p) => p.key === 'obj:0')!
      expect(`${movedCol.x},${movedCol.y}`).not.toBe('7,1')
      expect(`${movedCol.x},${movedCol.y}`).not.toBe('4,2')
      expect([6, 7]).toContain(movedCol.x)
      expect([1, 2]).toContain(movedCol.y)

      // Blocking all 4 floor/ceil combinations around (6.889, 1.367) leaves the column in place with a note.
      const allBlockedPlan = planShift(
        fallbackMap,
        effect,
        [
          { key: 'pc:b1', x: 6, y: 1 },
          { key: 'pc:b2', x: 7, y: 1 },
          { key: 'pc:b3', x: 6, y: 2 },
          { key: 'pc:b4', x: 7, y: 2 },
        ],
        { phase: 1, random: Math.random },
      )
      expect(allBlockedPlan.map.pieces.find((p) => p.key === 'obj:0')).toMatchObject({ x: 4, y: 2 })
      expect(allBlockedPlan.notes.some((n) => n.includes('Tall column'))).toBe(true)
    })

    it('chasms on Inverted Reliquary arena adds 2 chasm areas once, moves chasm tokens to nearest island, and leaves island tokens put', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'inverted-reliquary', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('inverted-reliquary')!

      const plan = planShift(
        map,
        effect,
        [
          { key: 'pc:north', x: 6, y: 3 },
          { key: 'pc:south', x: 7, y: 10 },
          { key: 'pc:safe', x: 2, y: 2 },
        ],
        { phase: 1, random: Math.random },
      )
      expect(plan.save).toBeUndefined()
      const chasms = (plan.map.areas ?? []).filter((a) => a.kind === 'chasm')
      expect(chasms).toHaveLength(2)
      expect(plan.moves).toEqual([
        { key: 'pc:north', x: 5, y: 3 },
        { key: 'pc:south', x: 8, y: 10 },
      ])
      expect(plan.notes).toEqual([
        'pc:north was over the void and moved to the nearest island',
        'pc:south was over the void and moved to the nearest island',
      ])

      const second = planShift(plan.map, effect, [{ key: 'pc:safe', x: 2, y: 2 }], {
        phase: 1,
        random: Math.random,
      })
      expect((second.map.areas ?? []).filter((a) => a.kind === 'chasm')).toHaveLength(2)
      expect(second.map.areas).toHaveLength(plan.map.areas!.length)
      expect(second.moves).toEqual([])
    })

    it('chasms avoids squares claimed by earlier moved tokens', () => {
      const map = placeArena({ kind: 'boss', boss: { id: 'inverted-reliquary', partySize: 4 } } as Room)!
      const effect = shiftEffectOf('inverted-reliquary')!

      const plan = planShift(
        map,
        effect,
        [
          { key: 'pc:first', x: 6, y: 3 },
          { key: 'pc:second', x: 6, y: 3 },
        ],
        { phase: 1, random: Math.random },
      )
      expect(plan.moves).toEqual([
        { key: 'pc:first', x: 5, y: 3 },
        { key: 'pc:second', x: 5, y: 2 },
      ])
    })

    it('halves on Ophaniel arena paints meadow west / stone east first, rotates clockwise each press, and keeps other areas', () => {
      const baseMap = placeArena({ kind: 'boss', boss: { id: 'ophaniel', partySize: 4 } } as Room)!
      const otherArea = { key: 'area:keep', kind: 'ledge', name: 'Kept', x: 1, y: 1, w: 2, h: 2 }
      const map: BattleMap = { ...baseMap, areas: [...(baseMap.areas ?? []), otherArea] }
      const effect = shiftEffectOf('ophaniel')!
      const baseCount = baseMap.areas?.length ?? 0
      const ctx = { phase: 1, random: Math.random }

      const p1 = planShift(map, effect, [{ key: 'pc:a', x: 2, y: 5 }], ctx)
      expect(p1.save).toBeUndefined()
      expect(p1.moves).toEqual([])
      expect(p1.notes).toEqual([])
      expect(p1.map.areas).toHaveLength(baseCount + 3)
      expect(p1.map.areas).toContainEqual(otherArea)
      expect(p1.map.areas?.find((a) => a.key === 'half:0')).toMatchObject({
        kind: 'meadow',
        name: 'Golden meadow: regain HP each turn, take double damage',
        x: 0,
        y: 0,
        w: 7,
        h: 14,
      })
      expect(p1.map.areas?.find((a) => a.key === 'half:1')).toMatchObject({
        kind: 'stone',
        name: 'Shattered stone: airless, Silence, necrotic damage',
        x: 7,
        y: 0,
        w: 7,
        h: 14,
      })

      const p2 = planShift(p1.map, effect, [], ctx)
      expect(p2.map.areas).toHaveLength(baseCount + 3)
      expect(p2.map.areas?.find((a) => a.key === 'half:0')).toMatchObject({ kind: 'meadow', x: 0, y: 0, w: 14, h: 7 })
      expect(p2.map.areas?.find((a) => a.key === 'half:1')).toMatchObject({ kind: 'stone', x: 0, y: 7, w: 14, h: 7 })

      const p3 = planShift(p2.map, effect, [], ctx)
      expect(p3.map.areas).toHaveLength(baseCount + 3)
      expect(p3.map.areas?.find((a) => a.key === 'half:0')).toMatchObject({ kind: 'meadow', x: 7, y: 0, w: 7, h: 14 })
      expect(p3.map.areas?.find((a) => a.key === 'half:1')).toMatchObject({ kind: 'stone', x: 0, y: 0, w: 7, h: 14 })

      const p4 = planShift(p3.map, effect, [], ctx)
      expect(p4.map.areas).toHaveLength(baseCount + 3)
      expect(p4.map.areas?.find((a) => a.key === 'half:0')).toMatchObject({ kind: 'meadow', x: 0, y: 7, w: 14, h: 7 })
      expect(p4.map.areas?.find((a) => a.key === 'half:1')).toMatchObject({ kind: 'stone', x: 0, y: 0, w: 14, h: 7 })

      const p5 = planShift(p4.map, effect, [], ctx)
      expect(p5.map.areas).toHaveLength(baseCount + 3)
      expect(p5.map.areas?.find((a) => a.key === 'half:0')).toMatchObject({ kind: 'meadow', x: 0, y: 0, w: 7, h: 14 })
      expect(p5.map.areas?.find((a) => a.key === 'half:1')).toMatchObject({ kind: 'stone', x: 7, y: 0, w: 7, h: 14 })

      const realP1 = planShift(baseMap, effect, [], ctx)
      const realP2 = planShift(realP1.map, effect, [], ctx)
      expect(realP1.map.areas).toHaveLength(baseCount + 2)
      expect(realP2.map.areas).toHaveLength(baseCount + 2)
    })

    it('eclipse on Husk arena alternates Blinding Zenith and Total Umbra around boss in phase 1 and phase 2', () => {
      const baseMap = placeArena({ kind: 'boss', boss: { id: 'sun-eaters-husk', partySize: 4 } } as Room)!
      const otherArea = { key: 'area:keep', kind: 'plinth', name: 'Kept', x: 2, y: 2, w: 1, h: 1 }
      const map: BattleMap = { ...baseMap, areas: [...(baseMap.areas ?? []), otherArea] }
      const effect = shiftEffectOf('sun-eaters-husk')!

      const p1 = planShift(map, effect, [{ key: 'pc:a', x: 6, y: 10 }], { phase: 1, random: Math.random })
      expect(p1.save).toBeUndefined()
      expect(p1.moves).toEqual([])
      expect(p1.notes).toEqual([])
      expect(p1.map.areas).toContainEqual(otherArea)
      expect(p1.map.areas?.find((a) => a.key === 'eclipse:0')).toEqual({
        key: 'eclipse:0',
        kind: 'zenith',
        name: 'Blinding Zenith: 2 x PB radiant and Blinded out of cover',
        x: 0,
        y: 0,
        w: 14,
        h: 14,
      })

      const p2 = planShift(p1.map, effect, [], { phase: 1, random: Math.random })
      expect(p2.save).toBeUndefined()
      expect(p2.moves).toEqual([])
      expect(p2.notes).toEqual([])
      expect(p2.map.areas).toHaveLength((map.areas?.length ?? 0) + 1)
      expect(p2.map.areas?.find((a) => a.key === 'eclipse:0')).toEqual({
        key: 'eclipse:0',
        kind: 'umbra',
        name: 'Total Umbra: magical darkness outside this ring (2 x PB cold or necrotic)',
        x: 3,
        y: 0,
        w: 8,
        h: 6,
      })

      const p3 = planShift(p2.map, effect, [], { phase: 2, random: Math.random })
      expect(p3.map.areas?.find((a) => a.key === 'eclipse:0')).toMatchObject({
        kind: 'zenith',
        x: 0,
        y: 0,
        w: 14,
        h: 14,
      })

      const p4 = planShift(p3.map, effect, [], { phase: 2, random: Math.random })
      expect(p4.map.areas?.find((a) => a.key === 'eclipse:0')).toMatchObject({
        kind: 'umbra',
        x: 3,
        y: 0,
        w: 8,
        h: 6,
      })

      const noBossMap: BattleMap = { squares: 14, entrance: 'south', pieces: [] }
      const noBossZenith = planShift(noBossMap, effect, [], { phase: 1, random: Math.random })
      const noBossUmbra = planShift(noBossZenith.map, effect, [], { phase: 1, random: Math.random })
      expect(noBossUmbra.map.areas?.find((a) => a.key === 'eclipse:0')).toMatchObject({
        kind: 'umbra',
        x: 0,
        y: 0,
        w: 14,
        h: 14,
      })
    })
  })

  describe('rotateBoxClockwise', () => {
    it('rotates 1x1 and rectangular boxes clockwise about the grid centre', () => {
      expect(rotateBoxClockwise({ x: 0, y: 0, w: 1, h: 1 }, 14)).toEqual({
        x: 13,
        y: 0,
        w: 1,
        h: 1,
      })
      expect(rotateBoxClockwise({ x: 2, y: 1, w: 3, h: 2 }, 14)).toEqual({
        x: 11,
        y: 2,
        w: 2,
        h: 3,
      })
    })
  })
  it('with only set, unticked tokens stay put and block the ones that move', () => {
    const map: BattleMap = { squares: 14, entrance: 'south', pieces: [] }
    const effect = { kind: 'tilt', save: 'Dex save', squares: 3, carry: [] } as unknown as Parameters<typeof planShift>[1]
    const tokens: TokenPos[] = [
      { key: 'pc:front', x: 5, y: 3 },
      { key: 'pc:back', x: 5, y: 5 },
    ]
    const plan = planShift(map, effect, tokens, { phase: 1, random: Math.random, direction: 'N', only: new Set(['pc:back']) })
    expect(plan.moves).toEqual([{ key: 'pc:back', x: 5, y: 4 }])
  })
})
