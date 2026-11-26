import { describe, expect, it } from 'vitest'
import type { DraftOffer, Run, RunPlayer, RunState } from '../model/run'
import type { Encounter } from '../rules/encounters'
import { emptyLoot, SHRINE_TERRAIN, type LootItem } from '../rules/loot'
import type { Room, RoomView } from '../rules/rooms'
import { deriveLoreEvents } from './runEvents'

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
    flavor: [],
    trueExit: null,
    oddity: null,
    tricks: [],
    condition: null,
    ...overrides,
  }
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    floor: 1,
    room: 1,
    kind: 'combat',
    shape: 'square',
    size: 'medium',
    elevation: 1,
    lighting: 'dim',
    exits: 2,
    trueExit: 1,
    terrain: [],
    flavor: [],
    oddity: null,
    tricks: [],
    condition: null,
    revealed: { trueExit: false, falseWall: false, oddity: false, condition: false },
    ...overrides,
  }
}

function makePlayer(characterId: string, overrides: Partial<RunPlayer> = {}): RunPlayer {
  return {
    characterId,
    name: characterId,
    alive: true,
    quantumBasaltsEarned: 0,
    quantumBasaltsPassed: 0,
    passes: 0,
    devotions: 0,
    slots: [null, null, null],
    hiddenBoonId: null,
    draft: null,
    diedOnFloor: null,
    lockoutDays: null,
    lockoutRolls: null,
    ...overrides,
  }
}

function makeRunState(overrides: {
  run?: Partial<Run>
  players?: RunPlayer[]
  dm?: RunState['dm']
} = {}): RunState {
  const players = overrides.players ?? [makePlayer('p1'), makePlayer('p2')]
  return {
    run: {
      id: 'run-1',
      joinCode: 'ABCD',
      status: 'active',
      characterIds: players.map((p) => p.characterId),
      partyLevel: 5,
      partySize: players.length,
      entryMultiplier: 1,
      pressures: [],
      pressureBonusPercent: 0,
      floor: 1,
      room: 1,
      awaitingChoice: false,
      lastBossFloor: 0,
      log: [],
      lootKeptPercent: null,
      roomView: makeRoomView(),
      ...overrides.run,
    },
    players,
    ...(overrides.dm !== undefined ? { dm: overrides.dm } : {}),
  }
}

function makeDraft(overrides: Partial<DraftOffer> = {}): DraftOffer {
  return {
    floor: 1,
    room: 1,
    elite: false,
    offers: [],
    ...overrides,
  }
}

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    family: 'wardstones',
    splashFamily: null,
    elite: null,
    budget: 100,
    xp: 100,
    maxCr: 3,
    groups: [{ creatureId: 'hexling', cr: 1, count: 2, revealed: false }],
    ...overrides,
  }
}

function makeItem(uid: string, floor = 1, room = 1): LootItem {
  return {
    uid,
    kind: 'trinket',
    ref: '0',
    rarity: null,
    floor,
    room,
    source: 'room',
  }
}

describe('deriveLoreEvents', () => {
  it('emits run start events with pressures count and no pause', () => {
    const next = makeRunState({ run: { pressures: ['brittle-ground', 'narrow-seam'], floor: 1 } })
    const result = deriveLoreEvents(null, next)

    expect(result).toEqual({
      events: [
        { type: 'first_entry' },
        { type: 'pressures_chosen', values: { count: 2 } },
        { type: 'floor_first_arrival', arg: '1' },
      ],
      pauseRoomKey: null,
    })
  })

  it('emits floor_first_arrival when the floor increases', () => {
    const prev = makeRunState({ run: { floor: 1 } })
    const next = makeRunState({ run: { floor: 2, room: 1, roomView: makeRoomView({ floor: 2, room: 1 }) } })

    expect(deriveLoreEvents(prev, next)).toEqual({
      events: [{ type: 'floor_first_arrival', arg: '2' }],
      pauseRoomKey: null,
    })
  })

  it('emits boon_first_draft for a newly slotted boon, not when leveling a held boon', () => {
    const prev = makeRunState({
      players: [
        makePlayer('p1', { slots: [{ kind: 'boon', boonId: 'hardy', level: 1 }, null, null] }),
        makePlayer('p2', { slots: [null, null, null] }),
      ],
    })
    const next = makeRunState({
      players: [
        makePlayer('p1', {
          slots: [
            { kind: 'boon', boonId: 'hardy', level: 2 },
            { kind: 'boon', boonId: 'honed', level: 1 },
            null,
          ],
        }),
        makePlayer('p2', { slots: [{ kind: 'boon', boonId: 'honed', level: 1 }, null, null] }),
      ],
    })

    expect(deriveLoreEvents(prev, next).events).toEqual([
      { type: 'boon_first_level' },
      { type: 'boon_first_draft', arg: 'honed' },
    ])
  })

  it('emits boon_first_combination and no boon_first_draft for a new combination slot', () => {
    const prev = makeRunState({
      players: [
        makePlayer('p1', {
          slots: [
            { kind: 'boon', boonId: 'critical-delight', level: 3 },
            { kind: 'boon', boonId: 'crits-are-for-suckers', level: 3 },
            null,
          ],
        }),
        makePlayer('p2'),
      ],
    })
    const next = makeRunState({
      players: [
        makePlayer('p1', {
          slots: [{ kind: 'combination', combinationId: 'super-normal' }, null, null],
        }),
        makePlayer('p2'),
      ],
    })

    expect(deriveLoreEvents(prev, next).events).toEqual([{ type: 'boon_first_combination' }])
    expect(deriveLoreEvents(next, next).events).toEqual([])
  })

  it('emits boon_first_evolution and no boon_first_draft for a new evolution slot', () => {
    const prev = makeRunState({
      players: [
        makePlayer('p1', {
          slots: [{ kind: 'boon', boonId: 'ulmas-thread', level: 3 }, null, null],
        }),
        makePlayer('p2'),
      ],
    })
    const next = makeRunState({
      players: [
        makePlayer('p1', {
          slots: [{ kind: 'evolution', evolutionId: 'ball-of-yarn' }, null, null],
        }),
        makePlayer('p2'),
      ],
    })

    expect(deriveLoreEvents(prev, next).events).toEqual([{ type: 'boon_first_evolution' }])
    expect(deriveLoreEvents(next, next).events).toEqual([])
  })

  it('distinguishes class hidden boons from Thils gifts and guards unknown ids', () => {
    const prev = makeRunState()
    const withClass = makeRunState({
      players: [makePlayer('p1', { hiddenBoonId: 'pogs-path' }), makePlayer('p2')],
    })
    expect(deriveLoreEvents(prev, withClass).events).toEqual([
      { type: 'hidden_boon_first', arg: 'pogs-path' },
    ])

    const withGift = makeRunState({
      players: [makePlayer('p1', { hiddenBoonId: 'keeper-of-ways' }), makePlayer('p2')],
    })
    expect(deriveLoreEvents(prev, withGift).events).toEqual([
      { type: 'hidden_boon_first', arg: 'keeper-of-ways' },
      { type: 'hidden_gift_first' },
    ])

    const withUnknown = makeRunState({
      players: [makePlayer('p1', { hiddenBoonId: 'mystery-boon' }), makePlayer('p2')],
    })
    expect(deriveLoreEvents(prev, withUnknown).events).toEqual([
      { type: 'hidden_boon_first', arg: 'mystery-boon' },
    ])
  })

  it('emits immediate boss_first_meet on boss room open and does not repeat in the same room', () => {
    const prev = makeRunState({
      run: { floor: 1, room: 4, roomView: makeRoomView({ floor: 1, room: 4 }) },
      dm: { floorPlan: ['combat', 'combat', 'combat', 'combat'], room: makeRoom({ floor: 1, room: 4 }) },
    })
    const opened = makeRunState({
      run: { floor: 1, room: 5, roomView: makeRoomView({ floor: 1, room: 5, kind: 'boss', bossId: 'gatewright' }) },
      dm: {
        floorPlan: ['combat', 'combat', 'combat', 'combat'],
        room: makeRoom({ floor: 1, room: 5, kind: 'boss', boss: { id: 'gatewright', partySize: 2 } }),
      },
    })

    expect(deriveLoreEvents(prev, opened)).toEqual({
      events: [{ type: 'boss_first_meet', arg: 'gatewright', immediate: true }],
      pauseRoomKey: null,
    })

    const nextSaveInSameRoom = makeRunState({
      ...opened,
      run: { ...opened.run, roomView: makeRoomView({ floor: 1, room: 5, kind: 'boss', bossId: 'gatewright', bossBloodied: true }) },
      dm: {
        ...opened.dm!,
        room: makeRoom({ floor: 1, room: 5, kind: 'boss', boss: { id: 'gatewright', partySize: 2 }, cycle: 1 }),
      },
    })

    expect(deriveLoreEvents(opened, nextSaveInSameRoom)).toEqual({
      events: [],
      pauseRoomKey: null,
    })
  })

  it('emits family_first_meet per distinct family on a new encounter room and does not repeat in the same room', () => {
    const prev = makeRunState({
      run: { floor: 1, room: 1, roomView: makeRoomView({ floor: 1, room: 1 }) },
      dm: {
        floorPlan: ['combat', 'combat', 'combat', 'combat'],
        room: makeRoom({ floor: 1, room: 1 }),
      },
    })
    const entered = makeRunState({
      run: { floor: 1, room: 2, roomView: makeRoomView({ floor: 1, room: 2 }) },
      dm: {
        floorPlan: ['combat', 'combat', 'combat', 'combat'],
        room: makeRoom({
          floor: 1,
          room: 2,
          encounter: makeEncounter({
            family: 'wardstones',
            splashFamily: 'mazework',
            groups: [
              { creatureId: 'hexling', cr: 1, count: 2, revealed: false },
              { creatureId: 'column-sentinel', cr: 2, count: 1, revealed: false },
              { creatureId: 'corner-bull', cr: 3, count: 1, source: 'splash', revealed: false },
            ],
          }),
        }),
      },
    })

    expect(deriveLoreEvents(prev, entered).events).toEqual([
      { type: 'family_first_meet', arg: 'wardstones', immediate: true },
      { type: 'family_first_meet', arg: 'mazework', immediate: true },
    ])

    const sameRoomSavedAgain = makeRunState({
      ...entered,
      dm: {
        ...entered.dm!,
        room: makeRoom({
          ...entered.dm!.room!,
          encounter: makeEncounter({
            family: 'wardstones',
            splashFamily: 'mazework',
            groups: [
              { creatureId: 'hexling', cr: 1, count: 2, revealed: true },
              { creatureId: 'column-sentinel', cr: 2, count: 1, revealed: false },
              { creatureId: 'corner-bull', cr: 3, count: 1, source: 'splash', revealed: false },
            ],
          }),
        }),
      },
    })
    expect(deriveLoreEvents(entered, sameRoomSavedAgain).events).toEqual([])
  })

  it('emits family_first_meet at run start, includes group families, and skips unknown creature ids', () => {
    const atStart = makeRunState({
      run: { floor: 2, room: 1, roomView: makeRoomView({ floor: 2, room: 1 }) },
      dm: {
        floorPlan: ['combat', 'elite', 'combat', 'combat'],
        room: makeRoom({
          floor: 2,
          room: 1,
          encounter: makeEncounter({
            family: 'the-lost',
            splashFamily: null,
            elite: 'next-floor',
            groups: [
              { creatureId: 'the-overlooked', cr: 1, count: 2, revealed: false },
              { creatureId: 'echo-scout', cr: 0.5, count: 1, source: 'elite', revealed: false },
              { creatureId: 'unknown-creature', cr: 1, count: 1, revealed: false },
            ],
          }),
        }),
      },
    })

    expect(deriveLoreEvents(null, atStart).events).toEqual([
      { type: 'first_entry' },
      { type: 'pressures_chosen', values: { count: 0 } },
      { type: 'floor_first_arrival', arg: '2' },
      { type: 'family_first_meet', arg: 'the-lost', immediate: true },
      { type: 'family_first_meet', arg: 'absorbed-echoes', immediate: true },
    ])
  })

  it('emits no family events for a boss room without an encounter', () => {
    const prev = makeRunState({
      run: { floor: 1, room: 4, roomView: makeRoomView({ floor: 1, room: 4 }) },
      dm: {
        floorPlan: ['combat', 'combat', 'combat', 'combat'],
        room: makeRoom({ floor: 1, room: 4 }),
      },
    })
    const bossRoom = makeRunState({
      run: {
        floor: 1,
        room: 5,
        roomView: makeRoomView({ floor: 1, room: 5, kind: 'boss', bossId: 'gatewright' }),
      },
      dm: {
        floorPlan: ['combat', 'combat', 'combat', 'combat'],
        room: makeRoom({
          floor: 1,
          room: 5,
          kind: 'boss',
          encounter: null,
          boss: { id: 'gatewright', partySize: 2 },
        }),
      },
    })

    expect(deriveLoreEvents(prev, bossRoom).events).toEqual([
      { type: 'boss_first_meet', arg: 'gatewright', immediate: true },
    ])
  })

  it('emits loot_reveal with current floor when loot items grow', () => {
    const prev = makeRunState({
      run: { floor: 3, loot: { ...emptyLoot(), items: [makeItem('L1', 3, 1)] } },
    })
    const next = makeRunState({
      run: { floor: 3, loot: { ...emptyLoot(), items: [makeItem('L1', 3, 1), makeItem('L2', 3, 2)] } },
    })

    expect(deriveLoreEvents(prev, next).events).toEqual([
      { type: 'loot_reveal', values: { floor: 3 } },
    ])
  })

  it('maps oddity index 0 to arg "1" in the same room', () => {
    const prev = makeRunState({
      run: { roomView: makeRoomView({ floor: 1, room: 2, oddity: null }) },
    })
    const next = makeRunState({
      run: { roomView: makeRoomView({ floor: 1, room: 2, oddity: 0 }) },
    })

    expect(deriveLoreEvents(prev, next).events).toEqual([
      { type: 'oddity', arg: '1' },
    ])
  })

  it('emits a single thils_touch when condition is met and trick is sprung together', () => {
    const prev = makeRunState({
      run: { roomView: makeRoomView({ floor: 1, room: 2, condition: null, tricks: [] }) },
    })
    const next = makeRunState({
      run: { roomView: makeRoomView({ floor: 1, room: 2, condition: 14, tricks: ['shifting-tiles'] }) },
    })

    expect(deriveLoreEvents(prev, next).events).toEqual([
      { type: 'thils_touch' },
    ])
  })

  it('emits shrine_first and thils_touch when entering a room with a shrine, without repeating', () => {
    const prev = makeRunState({
      run: { floor: 1, room: 1, roomView: makeRoomView({ floor: 1, room: 1, terrain: [] }) },
    })
    const entered = makeRunState({
      run: { floor: 1, room: 2, roomView: makeRoomView({ floor: 1, room: 2, terrain: [SHRINE_TERRAIN] }) },
    })

    expect(deriveLoreEvents(prev, entered).events).toEqual([
      { type: 'shrine_first' },
      { type: 'thils_touch' },
    ])

    const stayed = makeRunState({
      run: { floor: 1, room: 2, roomView: makeRoomView({ floor: 1, room: 2, terrain: [SHRINE_TERRAIN], trueExit: 1 }) },
    })
    expect(deriveLoreEvents(entered, stayed).events).toEqual([])
  })

  it('emits thils_touch when Thils\'s Vault opens', () => {
    const prev = makeRunState({ run: { floor: 5, room: 1, vaultOpen: false } })
    const next = makeRunState({ run: { floor: 5, room: 1, vaultOpen: true } })

    expect(deriveLoreEvents(prev, next).events).toEqual([
      { type: 'thils_touch' },
    ])
  })

  it('emits first_qb when any player\'s earned or passed Quantum Basalts increase', () => {
    const prev = makeRunState()
    const earned = makeRunState({
      players: [makePlayer('p1', { quantumBasaltsEarned: 5 }), makePlayer('p2')],
    })
    const passed = makeRunState({
      players: [makePlayer('p1'), makePlayer('p2', { quantumBasaltsPassed: 1 })],
    })

    expect(deriveLoreEvents(prev, earned).events).toEqual([{ type: 'first_qb' }])
    expect(deriveLoreEvents(prev, passed).events).toEqual([{ type: 'first_qb' }])
  })

  it('emits first_death on active runs and wiped runs, with no other events or pause on wipe', () => {
    const prev = makeRunState({
      run: { floor: 2, room: 3 },
      players: [makePlayer('p1', { alive: true }), makePlayer('p2', { alive: false })],
    })
    const oneDied = makeRunState({
      run: { floor: 2, room: 3 },
      players: [makePlayer('p1', { alive: true }), makePlayer('p2', { alive: false })],
    })
    // Active death: p1 dies while p2 is alive
    const prevActive = makeRunState({
      run: { floor: 2, room: 3 },
      players: [makePlayer('p1', { alive: true }), makePlayer('p2', { alive: true })],
    })
    const p1Died = makeRunState({
      run: { floor: 2, room: 3 },
      players: [makePlayer('p1', { alive: false }), makePlayer('p2', { alive: true })],
    })
    expect(deriveLoreEvents(prevActive, p1Died)).toEqual({
      events: [{ type: 'first_death' }],
      pauseRoomKey: null,
    })

    // Wipe: last living player dies and status becomes wiped
    const wiped = makeRunState({
      run: { status: 'wiped', floor: 2, room: 3, log: [{ floor: 2, room: 3, kind: 'combat' }] },
      players: [makePlayer('p1', { alive: false }), makePlayer('p2', { alive: false })],
    })
    expect(deriveLoreEvents(prev, wiped)).toEqual({
      events: [{ type: 'first_death' }],
      pauseRoomKey: null,
    })

    // Extracted run with no deaths emits nothing
    const extracted = makeRunState({
      run: { status: 'extracted', floor: 2, room: 5, vaultOpen: true },
      players: [makePlayer('p1', { alive: true }), makePlayer('p2', { alive: false })],
    })
    expect(deriveLoreEvents(oneDied, extracted)).toEqual({
      events: [],
      pauseRoomKey: null,
    })
  })

  it('returns pauseRoomKey on room clear, draft resolved, and "start" before room 1', () => {
    // Starting boon draft resolved before room 1
    const preRoom1 = makeRunState({
      run: { log: [] },
      players: [makePlayer('p1', { draft: makeDraft({ starting: true }) }), makePlayer('p2')],
    })
    const startDraftResolved = makeRunState({
      run: { log: [] },
      players: [makePlayer('p1', { draft: null }), makePlayer('p2')],
    })
    expect(deriveLoreEvents(preRoom1, startDraftResolved)).toEqual({
      events: [],
      pauseRoomKey: 'start',
    })

    // Room clear appends to log
    const beforeClear = makeRunState({
      run: { floor: 1, room: 2, log: [{ floor: 1, room: 1, kind: 'combat' }] },
    })
    const afterClear = makeRunState({
      run: {
        floor: 1,
        room: 3,
        log: [
          { floor: 1, room: 1, kind: 'combat' },
          { floor: 1, room: 2, kind: 'elite' },
        ],
      },
    })
    expect(deriveLoreEvents(beforeClear, afterClear)).toEqual({
      events: [],
      pauseRoomKey: '1-2',
    })

    // Draft resolved after room clear uses the last log entry's key
    const openDraft = makeRunState({
      run: {
        floor: 1,
        room: 3,
        log: [
          { floor: 1, room: 1, kind: 'combat' },
          { floor: 1, room: 2, kind: 'elite' },
        ],
      },
      players: [makePlayer('p1', { draft: makeDraft({ floor: 1, room: 2 }) }), makePlayer('p2')],
    })
    const resolvedDraft = makeRunState({
      ...openDraft,
      players: [makePlayer('p1', { draft: null }), makePlayer('p2')],
    })
    expect(deriveLoreEvents(openDraft, resolvedDraft)).toEqual({
      events: [],
      pauseRoomKey: '1-2',
    })
  })

  it('returns no events and no pause on ordinary or unchanged saves', () => {
    const state = makeRunState({
      run: { floor: 1, room: 2, log: [{ floor: 1, room: 1, kind: 'combat' }] },
      players: [makePlayer('p1', { passes: 0 }), makePlayer('p2')],
    })

    expect(deriveLoreEvents(state, state)).toEqual({
      events: [],
      pauseRoomKey: null,
    })

    const ordinaryChange = makeRunState({
      ...state,
      run: { ...state.run, lootCall: true },
    })
    expect(deriveLoreEvents(state, ordinaryChange)).toEqual({
      events: [],
      pauseRoomKey: null,
    })
  })
})
