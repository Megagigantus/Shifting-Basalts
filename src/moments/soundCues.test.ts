import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import type { Slot } from '../rules/boons'
import type { LootItem, LootPick } from '../rules/loot'
import type { RoomView } from '../rules/rooms'
import { newRunState } from '../rules/runFlow'
import {
  checkSoundCues,
  cuePlaysOn,
  cuesFromChange,
  SOUND_CUES,
  type CueScreens,
} from './soundCues'
import { THEME } from './theme'

const character = (id: string, overrides: Partial<Character> = {}): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level: 5,
  ...overrides,
})

function makeState(runId = 'run-1'): RunState {
  return newRunState(
    runId,
    'ABCD',
    [character('a', { name: 'Aria' }), character('b', { name: 'Bram' })],
    [],
  )
}

function makeRoomView(overrides: Partial<RoomView> = {}): RoomView {
  return {
    floor: 1,
    room: 1,
    kind: 'combat',
    shape: 'square',
    size: 'medium',
    elevation: 1,
    lighting: 'dim',
    exits: 2,
    terrain: [],
    flavor: [0],
    trueExit: null,
    oddity: null,
    tricks: [],
    condition: null,
    shifts: [],
    ...overrides,
  }
}

function makeItem(uid: string): LootItem {
  return {
    uid,
    kind: 'trinket',
    ref: '0',
    rarity: null,
    floor: 1,
    room: 1,
    source: 'room',
  }
}

function withLootShare(state: RunState, picks: LootPick[]): RunState {
  return {
    ...state,
    run: {
      ...state.run,
      lootShare: {
        keptPercent: 50,
        keptValue: 100,
        itemsValue: 50,
        creditsPayout: 50,
        picks,
      },
    },
  }
}

function withPlayerSlots(state: RunState, characterId: string, slots: Slot[]): RunState {
  return {
    ...state,
    players: state.players.map((p) => (p.characterId === characterId ? { ...p, slots } : p)),
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
  }
  return value
}

describe('SOUND_CUES', () => {
  it('loads the cues map from sound-cues.json without _note', () => {
    expect(SOUND_CUES.roomOpen).toBe('table')
    expect(SOUND_CUES.loot).toBe('tableAndOwn')
    expect(SOUND_CUES.spendBasalts).toBe('own')
    expect('_note' in SOUND_CUES).toBe(false)
  })
})

describe('cuesFromChange', () => {
  it('returns [] when prev is null or run id differs (3a)', () => {
    const next: RunState = {
      ...makeState('run-2'),
      run: { ...makeState('run-2').run, roomView: makeRoomView() },
    }
    expect(cuesFromChange(null, next)).toEqual([])

    const prevDifferent = makeState('run-1')
    expect(cuesFromChange(prevDifferent, next)).toEqual([])
  })

  it('emits roomOpen or bossReveal when a room opens, and skips shift and trap on that change (3b)', () => {
    const base = makeState()

    const openedFromNull: RunState = {
      ...base,
      run: {
        ...base.run,
        roomView: makeRoomView({
          floor: 1,
          room: 1,
          kind: 'combat',
          shifts: ['boss-1'],
          tricks: ['pit'],
          condition: 7,
        }),
      },
    }
    expect(cuesFromChange(base, openedFromNull)).toEqual([
      { key: 'roomOpen', characterId: null },
    ])

    const openedRoom2: RunState = {
      ...openedFromNull,
      run: {
        ...openedFromNull.run,
        roomView: makeRoomView({
          floor: 1,
          room: 2,
          kind: 'elite',
          shifts: ['boss-1', 'boss-2'],
          tricks: ['pit', 'darts'],
          condition: 12,
        }),
      },
    }
    expect(cuesFromChange(openedFromNull, openedRoom2)).toEqual([
      { key: 'roomOpen', characterId: null },
    ])

    const openedBossFloor2: RunState = {
      ...openedRoom2,
      run: {
        ...openedRoom2.run,
        roomView: makeRoomView({
          floor: 2,
          room: 2,
          kind: 'boss',
          shifts: ['boss-1', 'boss-2', 'boss-3'],
        }),
      },
    }
    expect(cuesFromChange(openedRoom2, openedBossFloor2)).toEqual([
      { key: 'bossReveal', characterId: null },
    ])

    const clearedRoomView: RunState = {
      ...openedBossFloor2,
      run: { ...openedBossFloor2.run, roomView: null },
    }
    expect(cuesFromChange(openedBossFloor2, clearedRoomView)).toEqual([])
  })

  it('emits shift in the same room only when roomView.shifts grows (3c)', () => {
    const prev: RunState = {
      ...makeState(),
      run: { ...makeState().run, roomView: makeRoomView({ shifts: undefined }) },
    }
    const afterFirstShift: RunState = {
      ...prev,
      run: { ...prev.run, roomView: makeRoomView({ shifts: ['boss-1'] }) },
    }
    expect(cuesFromChange(prev, afterFirstShift)).toEqual([
      { key: 'shift', characterId: null },
    ])

    const unchanged: RunState = {
      ...afterFirstShift,
      run: { ...afterFirstShift.run, roomView: makeRoomView({ shifts: ['boss-1'] }) },
    }
    expect(cuesFromChange(afterFirstShift, unchanged)).toEqual([])

    const afterSecondShift: RunState = {
      ...afterFirstShift,
      run: { ...afterFirstShift.run, roomView: makeRoomView({ shifts: ['boss-1', 'boss-2'] }) },
    }
    expect(cuesFromChange(afterFirstShift, afterSecondShift)).toEqual([
      { key: 'shift', characterId: null },
    ])
  })

  it('emits at most one trap in the same room for new tricks or revealed condition (3d)', () => {
    const base = makeState()
    const prev: RunState = {
      ...base,
      run: { ...base.run, roomView: makeRoomView({ tricks: ['pit'], condition: null }) },
    }

    const withNewTrick: RunState = {
      ...prev,
      run: { ...prev.run, roomView: makeRoomView({ tricks: ['pit', 'darts'], condition: null }) },
    }
    expect(cuesFromChange(prev, withNewTrick)).toEqual([{ key: 'trap', characterId: null }])

    const withConditionFromUndefined: RunState = {
      ...prev,
      run: { ...prev.run, roomView: makeRoomView({ tricks: ['pit'], condition: undefined as unknown as null }) },
    }
    const revealedZero: RunState = {
      ...prev,
      run: { ...prev.run, roomView: makeRoomView({ tricks: ['pit'], condition: 0 }) },
    }
    expect(cuesFromChange(withConditionFromUndefined, revealedZero)).toEqual([
      { key: 'trap', characterId: null },
    ])

    const stillNumber: RunState = {
      ...revealedZero,
      run: { ...revealedZero.run, roomView: makeRoomView({ tricks: ['pit'], condition: 12 }) },
    }
    expect(cuesFromChange(revealedZero, stillNumber)).toEqual([])

    const multipleTrapsAtOnce: RunState = {
      ...prev,
      run: {
        ...prev.run,
        roomView: makeRoomView({ tricks: ['pit', 'darts', 'blades'], condition: 15 }),
      },
    }
    expect(cuesFromChange(prev, multipleTrapsAtOnce)).toEqual([
      { key: 'trap', characterId: null },
    ])
  })

  it('emits shared loot when loot.items.length increases, treating missing as 0 (3e)', () => {
    const prev = makeState()
    const nextOne: RunState = {
      ...prev,
      run: {
        ...prev.run,
        loot: { items: [makeItem('L1')], credits: 0, nextUid: 2, log: [], searched: [] },
      },
    }
    expect(cuesFromChange(prev, nextOne)).toEqual([{ key: 'loot', characterId: null }])

    const nextSame: RunState = {
      ...nextOne,
      run: {
        ...nextOne.run,
        loot: { ...nextOne.run.loot!, credits: 25 },
      },
    }
    expect(cuesFromChange(nextOne, nextSame)).toEqual([])

    const nextMore: RunState = {
      ...nextOne,
      run: {
        ...nextOne.run,
        loot: {
          ...nextOne.run.loot!,
          items: [makeItem('L1'), makeItem('L2'), makeItem('L3')],
          nextUid: 4,
        },
      },
    }
    expect(cuesFromChange(nextOne, nextMore)).toEqual([{ key: 'loot', characterId: null }])
  })

  it('emits loot per character for new lootShare picks, once per character (3f)', () => {
    const prev = makeState()
    const next = withLootShare(prev, [
      { uid: 'L1', characterId: 'a' },
      { uid: 'L2', characterId: 'a' },
      { uid: 'L3', characterId: 'b' },
    ])
    expect(cuesFromChange(prev, next)).toEqual([
      { key: 'loot', characterId: 'a' },
      { key: 'loot', characterId: 'b' },
    ])

    const reassigned = withLootShare(next, [
      { uid: 'L1', characterId: 'a' },
      { uid: 'L2', characterId: 'b' },
      { uid: 'L3', characterId: 'b' },
    ])
    expect(cuesFromChange(next, reassigned)).toEqual([
      { key: 'loot', characterId: 'b' },
    ])
  })

  it('emits fusionDone and evolutionDone for existing players only (3g)', () => {
    const base = makeState()
    const prev = withPlayerSlots(base, 'a', [
      { kind: 'boon', boonId: 'hardy', level: 3 },
      { kind: 'evolution', evolutionId: 'existing-evo' },
      null,
    ])

    const nextWithNewPlayer: RunState = {
      ...withPlayerSlots(
        withPlayerSlots(prev, 'a', [
          { kind: 'evolution', evolutionId: 'ball-of-yarn' },
          { kind: 'evolution', evolutionId: 'existing-evo', suppressed: true },
          { kind: 'combination', combinationId: 'super-normal' },
        ]),
        'b',
        [{ kind: 'boon', boonId: 'hardy', level: 2 }],
      ),
      players: [
        ...withPlayerSlots(prev, 'a', [
          { kind: 'evolution', evolutionId: 'ball-of-yarn' },
          { kind: 'evolution', evolutionId: 'existing-evo', suppressed: true },
          { kind: 'combination', combinationId: 'super-normal' },
        ]).players,
        {
          ...prev.players[0]!,
          characterId: 'c',
          name: 'Cael',
          slots: [
            { kind: 'evolution', evolutionId: 'new-joiner-evo' },
            { kind: 'combination', combinationId: 'new-joiner-combo' },
          ],
        },
      ],
    }

    expect(cuesFromChange(prev, nextWithNewPlayer)).toEqual([
      { key: 'evolutionDone', characterId: 'a' },
      { key: 'fusionDone', characterId: 'a' },
    ])
  })

  it('deduplicates events with the same key and characterId while preserving distinct ones (3h)', () => {
    const prev = makeState()
    const withLootAndSlots: RunState = {
      ...withLootShare(
        withPlayerSlots(prev, 'a', [
          { kind: 'evolution', evolutionId: 'evo-1' },
          { kind: 'evolution', evolutionId: 'evo-2' },
          { kind: 'combination', combinationId: 'combo-1' },
          { kind: 'combination', combinationId: 'combo-2' },
        ]),
        [{ uid: 'L1', characterId: 'a' }],
      ),
      run: {
        ...withLootShare(prev, [{ uid: 'L1', characterId: 'a' }]).run,
        loot: { items: [makeItem('L1')], credits: 0, nextUid: 2, log: [], searched: [] },
      },
    }

    expect(cuesFromChange(prev, withLootAndSlots)).toEqual([
      { key: 'loot', characterId: null },
      { key: 'loot', characterId: 'a' },
      { key: 'evolutionDone', characterId: 'a' },
      { key: 'fusionDone', characterId: 'a' },
    ])
  })

  it('never mutates its input snapshots (3i)', () => {
    const prev = deepFreeze({
      ...makeState(),
      run: { ...makeState().run, roomView: makeRoomView() },
    })
    const next = deepFreeze({
      ...withPlayerSlots(makeState(), 'a', [{ kind: 'evolution', evolutionId: 'ball-of-yarn' }]),
      run: {
        ...makeState().run,
        roomView: makeRoomView({ shifts: ['boss-1'], tricks: ['pit'] }),
        loot: { items: [makeItem('L1')], credits: 0, nextUid: 2, log: [], searched: [] },
      },
    })

    const cues = cuesFromChange(prev, next)
    expect(cues).toEqual([
      { key: 'shift', characterId: null },
      { key: 'trap', characterId: null },
      { key: 'loot', characterId: null },
      { key: 'evolutionDone', characterId: 'a' },
    ])
  })

  it('never reads state.dm', () => {
    const prev = makeState()
    const next: RunState = {
      ...withPlayerSlots(makeState(), 'a', [{ kind: 'combination', combinationId: 'super-normal' }]),
      run: {
        ...makeState().run,
        roomView: makeRoomView({ floor: 1, room: 1, kind: 'combat' }),
        loot: { items: [makeItem('L1')], credits: 0, nextUid: 2, log: [], searched: [] },
      },
    }
    Object.defineProperty(prev, 'dm', {
      configurable: true,
      get() {
        throw new Error('prev.dm must not be read')
      },
    })
    Object.defineProperty(next, 'dm', {
      configurable: true,
      get() {
        throw new Error('next.dm must not be read')
      },
    })

    expect(cuesFromChange(prev, next)).toEqual([
      { key: 'roomOpen', characterId: null },
      { key: 'loot', characterId: null },
      { key: 'fusionDone', characterId: 'a' },
    ])
  })
})

describe('cuePlaysOn', () => {
  it('returns false for unknown keys', () => {
    expect(cuePlaysOn({ key: 'doesNotExist', characterId: null }, { kind: 'table' })).toBe(false)
    expect(cuePlaysOn({ key: 'toString', characterId: 'a' }, { kind: 'player', characterIds: ['a'] })).toBe(false)
  })

  it('always returns false for the dm viewer', () => {
    expect(cuePlaysOn({ key: 'roomOpen', characterId: null }, { kind: 'dm' })).toBe(false)
    expect(cuePlaysOn({ key: 'loot', characterId: 'a' }, { kind: 'dm' })).toBe(false)
    expect(cuePlaysOn({ key: 'spendBasalts', characterId: 'a' }, { kind: 'dm' })).toBe(false)
  })

  it('plays table and tableAndOwn cues on the table viewer, and skips own cues', () => {
    expect(cuePlaysOn({ key: 'roomOpen', characterId: null }, { kind: 'table' })).toBe(true)
    expect(cuePlaysOn({ key: 'loot', characterId: null }, { kind: 'table' })).toBe(true)
    expect(cuePlaysOn({ key: 'loot', characterId: 'a' }, { kind: 'table' })).toBe(true)
    expect(cuePlaysOn({ key: 'spendBasalts', characterId: 'a' }, { kind: 'table' })).toBe(false)
  })

  it('plays tableAndOwn cues on a player viewer only when characterId matches viewer.characterIds', () => {
    expect(
      cuePlaysOn({ key: 'fusionDone', characterId: 'a' }, { kind: 'player', characterIds: ['a', 'b'] }),
    ).toBe(true)
    expect(
      cuePlaysOn({ key: 'fusionDone', characterId: 'c' }, { kind: 'player', characterIds: ['a', 'b'] }),
    ).toBe(false)
    expect(
      cuePlaysOn({ key: 'loot', characterId: null }, { kind: 'player', characterIds: ['a'] }),
    ).toBe(false)
    expect(
      cuePlaysOn({ key: 'roomOpen', characterId: null }, { kind: 'player', characterIds: ['a'] }),
    ).toBe(false)
    expect(
      cuePlaysOn({ key: 'roomOpen', characterId: 'a' }, { kind: 'player', characterIds: ['a'] }),
    ).toBe(false)
  })

  it('returns false for own cues on every viewer', () => {
    const custom: Record<string, CueScreens> = { tapOnly: 'own' }
    expect(cuePlaysOn({ key: 'tapOnly', characterId: null }, { kind: 'dm' }, custom)).toBe(false)
    expect(cuePlaysOn({ key: 'tapOnly', characterId: null }, { kind: 'table' }, custom)).toBe(false)
    expect(
      cuePlaysOn({ key: 'tapOnly', characterId: 'a' }, { kind: 'player', characterIds: ['a'] }, custom),
    ).toBe(false)
    expect(
      cuePlaysOn({ key: 'spendDevotions', characterId: 'a' }, { kind: 'player', characterIds: ['a'] }),
    ).toBe(false)
  })
})

describe('checkSoundCues', () => {
  it('returns [] for the bundled SOUND_CUES and THEME.sounds', () => {
    expect(checkSoundCues(SOUND_CUES, THEME.sounds)).toEqual([])
  })

  it('reports missing sound keys and invalid screens values', () => {
    const problems = checkSoundCues(
      {
        goodCue: 'table',
        missingSound: 'tableAndOwn',
        badScreens: 'dmOnly',
        bothBad: 'invalid',
      },
      {
        goodCue: '/sounds/good.mp3',
        badScreens: '/sounds/bad.mp3',
      },
    )
    expect(problems).toHaveLength(4)
    expect(problems.some((p) => p.includes('missingSound'))).toBe(true)
    expect(problems.some((p) => p.includes('badScreens'))).toBe(true)
    expect(problems.filter((p) => p.includes('bothBad'))).toHaveLength(2)
  })
})
