import { describe, expect, it } from 'vitest'
import type { LoreQueueItem } from './reveal'
import { cardsToQueue, expandHiddenBoonEvents, matchesTrigger, pickRelease } from './triggers'
import type { LoreCard, LoreState } from './types'

function makeCard(overrides: Partial<LoreCard> = {}): LoreCard {
  return {
    id: 'card-1',
    group: 'origins',
    title: 'Sample Card',
    trigger: { key: 'first_entry', label: 'First entry' },
    repeat: 'once_campaign',
    tier: 'open',
    source: 'canon',
    readAloud: 'Read aloud text.',
    push: '',
    dmTruth: 'DM truth.',
    placeholders: [],
    imagePrompt: 'Basalt gate.',
    imageUrl: null,
    order: 0,
    ...overrides,
  }
}

function makeState(overrides: Partial<LoreState> = {}): LoreState {
  return {
    settings: {
      tierLimit: 'deep',
      deepPerRun: 2,
      anchor: { name: 'Anchor', voiceNote: 'Calm' },
      ...overrides.settings,
    },
    seen: overrides.seen ?? {},
    bannedTerms: overrides.bannedTerms ?? [],
  }
}

function makeQueueItem(overrides: Partial<LoreQueueItem> = {}): LoreQueueItem {
  return {
    id: 'q-1',
    cardId: 'card-1',
    status: 'waiting',
    manual: false,
    order: 0,
    createdAtMs: 1000,
    ...overrides,
  }
}

describe('matchesTrigger', () => {
  it('matches no-arg keys and rejects wrong event types', () => {
    expect(matchesTrigger('first_entry', { type: 'first_entry' })).toBe(true)
    expect(matchesTrigger('first_entry', { type: 'first_entry', arg: 'extra' })).toBe(true)
    expect(matchesTrigger('first_entry', { type: 'first_death' })).toBe(false)
    expect(matchesTrigger('floor_first_arrival:2', { type: 'shrine_first', arg: '2' })).toBe(false)
  })

  it('matches exact args case-sensitively and requires event.arg', () => {
    expect(matchesTrigger('floor_first_arrival:2', { type: 'floor_first_arrival', arg: '2' })).toBe(true)
    expect(matchesTrigger('floor_first_arrival:2', { type: 'floor_first_arrival', arg: '3' })).toBe(false)
    expect(matchesTrigger('floor_first_arrival:2', { type: 'floor_first_arrival' })).toBe(false)

    expect(matchesTrigger('boon_first_draft:ulmas-thread', { type: 'boon_first_draft', arg: 'ulmas-thread' })).toBe(
      true,
    )
    expect(matchesTrigger('boon_first_draft:ulmas-thread', { type: 'boon_first_draft', arg: 'Ulmas-thread' })).toBe(
      false,
    )
  })

  it('matches prefix wildcards and pipe-separated alternatives with wildcards', () => {
    expect(
      matchesTrigger('boon_first_draft:elemains-*', {
        type: 'boon_first_draft',
        arg: 'elemains-flight-of-fancy',
      }),
    ).toBe(true)
    expect(
      matchesTrigger('boon_first_draft:elemains-*', {
        type: 'boon_first_draft',
        arg: 'ulmas-thread',
      }),
    ).toBe(false)
    expect(matchesTrigger('boon_first_draft:elemains-*', { type: 'boon_first_draft' })).toBe(false)

    const altKey = 'boon_first_draft:thalisanes-weave|weavers-*'
    expect(matchesTrigger(altKey, { type: 'boon_first_draft', arg: 'thalisanes-weave' })).toBe(true)
    expect(matchesTrigger(altKey, { type: 'boon_first_draft', arg: 'weavers-mending' })).toBe(true)
    expect(matchesTrigger(altKey, { type: 'boon_first_draft', arg: 'weavers' })).toBe(false)
    expect(matchesTrigger(altKey, { type: 'boon_first_draft', arg: 'other' })).toBe(false)
  })

  it('matches numeric comparisons and returns false when value is missing', () => {
    expect(matchesTrigger('loot_reveal:floor>=2', { type: 'loot_reveal', values: { floor: 2 } })).toBe(true)
    expect(matchesTrigger('loot_reveal:floor>=2', { type: 'loot_reveal', values: { floor: 3 } })).toBe(true)
    expect(matchesTrigger('loot_reveal:floor>=2', { type: 'loot_reveal', values: { floor: 1 } })).toBe(false)

    expect(matchesTrigger('loot_reveal:floor<2', { type: 'loot_reveal', values: { floor: 1 } })).toBe(true)
    expect(matchesTrigger('loot_reveal:floor<2', { type: 'loot_reveal', values: { floor: 2 } })).toBe(false)

    expect(matchesTrigger('loot_reveal:floor>=2', { type: 'loot_reveal', values: {} })).toBe(false)
    expect(matchesTrigger('loot_reveal:floor>=2', { type: 'loot_reveal' })).toBe(false)
  })

  it('matches pressures_chosen:N as event.values.count >= N', () => {
    expect(matchesTrigger('pressures_chosen:2', { type: 'pressures_chosen', values: { count: 1 } })).toBe(false)
    expect(matchesTrigger('pressures_chosen:2', { type: 'pressures_chosen', values: { count: 2 } })).toBe(true)
    expect(matchesTrigger('pressures_chosen:2', { type: 'pressures_chosen', values: { count: 4 } })).toBe(true)
    expect(matchesTrigger('pressures_chosen:2', { type: 'pressures_chosen' })).toBe(false)
  })

  it('never matches dispatch keys', () => {
    expect(matchesTrigger('dispatch', { type: 'dispatch' })).toBe(false)
    expect(matchesTrigger('dispatch', { type: 'first_entry' })).toBe(false)
  })
})

describe('expandHiddenBoonEvents', () => {
  const deck: LoreCard[] = [
    makeCard({ id: 'pog', trigger: { key: 'hidden_boon_first:pogs-path', label: "Pog's Path" } }),
    makeCard({ id: 'thils', trigger: { key: 'thils_touch', label: "Thils's Favor" } }),
  ]

  it('adds thils_touch only when no card matches hidden_boon_first', () => {
    const matched = expandHiddenBoonEvents(
      [{ type: 'first_entry' }, { type: 'hidden_boon_first', arg: 'pogs-path' }],
      deck,
    )
    expect(matched).toEqual([{ type: 'first_entry' }, { type: 'hidden_boon_first', arg: 'pogs-path' }])

    const unmatched = expandHiddenBoonEvents(
      [{ type: 'first_entry' }, { type: 'hidden_boon_first', arg: 'unbroken' }],
      deck,
    )
    expect(unmatched).toEqual([
      { type: 'first_entry' },
      { type: 'hidden_boon_first', arg: 'unbroken' },
      { type: 'thils_touch' },
    ])
  })
})

describe('cardsToQueue', () => {
  const cards: LoreCard[] = [
    makeCard({
      id: 'open-entry',
      order: 10,
      repeat: 'once_campaign',
      tier: 'open',
      trigger: { key: 'first_entry', label: 'First entry' },
    }),
    makeCard({
      id: 'repeat-shrine',
      order: 20,
      repeat: 'repeatable',
      tier: 'open',
      trigger: { key: 'shrine_first', label: 'Shrine' },
    }),
    makeCard({
      id: 'run-loot',
      order: 5,
      repeat: 'once_run',
      tier: 'guarded',
      trigger: { key: 'loot_reveal:floor>=2', label: 'Loot' },
    }),
    makeCard({
      id: 'boss-gatewright',
      order: 30,
      repeat: 'once_campaign',
      tier: 'guarded',
      trigger: { key: 'boss_first_meet:gatewright', label: 'Gatewright' },
    }),
    makeCard({
      id: 'deep-b',
      order: 50,
      repeat: 'once_campaign',
      tier: 'deep',
      trigger: { key: 'oddity:1', label: 'Oddity B' },
    }),
    makeCard({
      id: 'deep-a',
      order: 40,
      repeat: 'once_campaign',
      tier: 'deep',
      trigger: { key: 'oddity:1', label: 'Oddity A' },
    }),
    makeCard({
      id: 'adhoc-answer',
      order: 1,
      adHoc: true,
      repeat: 'once_campaign',
      tier: 'open',
      trigger: { key: 'first_entry', label: 'Ad hoc' },
    }),
    makeCard({
      id: 'dispatch-card',
      order: 2,
      repeat: 'once_campaign',
      tier: 'open',
      trigger: { key: 'dispatch', label: 'Dispatch' },
    }),
  ]

  it('respects seen, repeat modes, duplicates, adHoc, dispatch, deck order, and immediate flag', () => {
    const state = makeState({
      seen: {
        'open-entry': 12345,
        'repeat-shrine': 12345,
      },
    })
    const queue: LoreQueueItem[] = [
      makeQueueItem({ id: 'q-boss', cardId: 'boss-gatewright', status: 'waiting' }),
    ]

    const result = cardsToQueue({
      events: [
        { type: 'first_entry' },
        { type: 'shrine_first' },
        { type: 'loot_reveal', values: { floor: 2 } },
        { type: 'boss_first_meet', arg: 'gatewright', immediate: true },
        { type: 'dispatch' },
      ],
      cards,
      state,
      queue,
    })

    // open-entry dropped (seen once_campaign), boss-gatewright dropped (duplicate waiting),
    // adhoc-answer and dispatch-card dropped; repeat-shrine kept even though seen.
    // Sorted by card.order ascending: run-loot (5), repeat-shrine (20).
    expect(result).toEqual([
      { cardId: 'run-loot', order: 5, immediate: false },
      { cardId: 'repeat-shrine', order: 20, immediate: false },
    ])

    // Immediate flag propagates from matching boss event when not already queued.
    const bossOnly = cardsToQueue({
      events: [{ type: 'boss_first_meet', arg: 'gatewright', immediate: true }],
      cards,
      state: makeState(),
      queue: [],
    })
    expect(bossOnly).toEqual([{ cardId: 'boss-gatewright', order: 30, immediate: true }])
  })

  it('fires a once_run card again in a new run even after it was seen in an earlier run', () => {
    const result = cardsToQueue({
      events: [{ type: 'loot_reveal', values: { floor: 3 } }],
      cards,
      state: makeState({ seen: { 'run-loot': 1, 'open-entry': 1 } }),
      queue: [],
    })
    expect(result.map((r) => r.cardId)).toEqual(['run-loot'])
  })

  it('drops once_run when done this run but keeps it when only skipped', () => {
    const state = makeState()
    const event = [{ type: 'loot_reveal', values: { floor: 2 } }]

    expect(
      cardsToQueue({
        events: event,
        cards,
        state,
        queue: [makeQueueItem({ id: 'q-done', cardId: 'run-loot', status: 'done' })],
      }),
    ).toEqual([])

    expect(
      cardsToQueue({
        events: event,
        cards,
        state,
        queue: [makeQueueItem({ id: 'q-skip', cardId: 'run-loot', status: 'skipped' })],
      }),
    ).toEqual([{ cardId: 'run-loot', order: 5, immediate: false }])
  })

  it('enforces tierLimit and deepPerRun cap in deck order', () => {
    const oddityEvent = [{ type: 'oddity', arg: '1' }]

    // tierLimit: guarded drops all deep cards
    expect(
      cardsToQueue({
        events: oddityEvent,
        cards,
        state: makeState({ settings: { tierLimit: 'guarded', deepPerRun: 2, anchor: { name: 'A', voiceNote: '' } } }),
        queue: [],
      }),
    ).toEqual([])

    // deepPerRun: 1 with one deep card already done -> none added
    expect(
      cardsToQueue({
        events: oddityEvent,
        cards,
        state: makeState({ settings: { tierLimit: 'deep', deepPerRun: 1, anchor: { name: 'A', voiceNote: '' } } }),
        queue: [makeQueueItem({ id: 'q-deep', cardId: 'deep-a', status: 'done' })],
      }),
    ).toEqual([])

    // deepPerRun: 1 with none yet -> only the first deep card in deck order (deep-a, order 40) added
    expect(
      cardsToQueue({
        events: oddityEvent,
        cards,
        state: makeState({ settings: { tierLimit: 'deep', deepPerRun: 1, anchor: { name: 'A', voiceNote: '' } } }),
        queue: [],
      }),
    ).toEqual([{ cardId: 'deep-a', order: 40, immediate: false }])
  })
})

describe('pickRelease', () => {
  it('returns null when roomKey matches lastReleaseKey, a live item exists, or a pending ready/manual/immediate item exists', () => {
    const waiting = makeQueueItem({ id: 'w-1', status: 'waiting', order: 1, createdAtMs: 100 })

    expect(pickRelease({ queue: [waiting], roomKey: 'f1-r1', lastReleaseKey: 'f1-r1' })).toBeNull()

    expect(
      pickRelease({
        queue: [waiting, makeQueueItem({ id: 'live-1', status: 'live' })],
        roomKey: 'f1-r2',
        lastReleaseKey: 'f1-r1',
      }),
    ).toBeNull()

    expect(
      pickRelease({
        queue: [waiting, makeQueueItem({ id: 'ready-1', status: 'waiting', ready: true })],
        roomKey: 'f1-r2',
        lastReleaseKey: 'f1-r1',
      }),
    ).toBeNull()

    expect(
      pickRelease({
        queue: [waiting, makeQueueItem({ id: 'man-1', status: 'waiting', manual: true })],
        roomKey: 'f1-r2',
        lastReleaseKey: 'f1-r1',
      }),
    ).toBeNull()

    expect(
      pickRelease({
        queue: [waiting, makeQueueItem({ id: 'imm-1', status: 'waiting', immediate: true })],
        roomKey: 'f1-r2',
        lastReleaseKey: 'f1-r1',
      }),
    ).toBeNull()
  })

  it('returns the lowest-order waiting not-ready item, breaking ties by createdAtMs', () => {
    const queue: LoreQueueItem[] = [
      makeQueueItem({ id: 'done-0', status: 'done', order: 0, createdAtMs: 10 }),
      makeQueueItem({ id: 'w-20', status: 'waiting', order: 20, createdAtMs: 50 }),
      makeQueueItem({ id: 'w-10-late', status: 'waiting', order: 10, createdAtMs: 200 }),
      makeQueueItem({ id: 'w-10-early', status: 'waiting', order: 10, createdAtMs: 100 }),
    ]

    expect(pickRelease({ queue, roomKey: 'f1-r1', lastReleaseKey: null })).toBe('w-10-early')
    expect(pickRelease({ queue: [], roomKey: 'f1-r1', lastReleaseKey: null })).toBeNull()
  })
})
