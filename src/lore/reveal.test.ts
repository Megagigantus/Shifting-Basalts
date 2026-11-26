import { describe, expect, it } from 'vitest'
import {
  buildNote,
  buildRevealDoc,
  fillPlaceholders,
  missingFills,
  nextQueueItem,
  waitingCount,
  type LoreQueueItem,
  type RevealStage,
} from './reveal'
import type { LoreCard } from './types'

function makeCard(overrides: Partial<LoreCard> = {}): LoreCard {
  return {
    id: 'relic-echo-marker',
    group: 'relics',
    title: 'The Salt-Rim Compass',
    trigger: { key: 'shrine-entry', label: 'Entering a shrine' },
    repeat: 'once_campaign',
    tier: 'guarded',
    source: 'loremaster',
    readAloud:
      'Beside the cracked basin rests {item}, still pointing toward {place}. Even {item} hums in the dark.',
    push: 'Its needle trembles whenever someone speaks an oath.',
    dmTruth: 'Secretly forged by the Seventh Anchor to track lost scouts.',
    placeholders: ['item', 'place'],
    imagePrompt: 'Brass compass coated in white salt resting on dark basalt.',
    imageUrl: 'assets/scene-a1b2.webp',
    ...overrides,
  }
}

function makeQueueItem(overrides: Partial<LoreQueueItem> = {}): LoreQueueItem {
  return {
    id: 'q-1',
    cardId: 'relic-echo-marker',
    status: 'waiting',
    manual: false,
    order: 0,
    createdAtMs: 1000,
    ...overrides,
  }
}

const FORBIDDEN_REVEAL_KEYS = [
  'dmTruth',
  'readAloud',
  'id',
  'cardId',
  'trigger',
  'tier',
  'source',
  'imagePrompt',
  'placeholders',
  'repeat',
  'group',
]

describe('fillPlaceholders', () => {
  it('replaces filled placeholders with trimmed values and repeats every occurrence', () => {
    const text = 'Hold {item} near {place}, for {item} remembers.'
    expect(fillPlaceholders(text, { item: '  the brass key  ', place: 'the stair' })).toBe(
      'Hold the brass key near the stair, for the brass key remembers.',
    )
  })

  it('leaves missing and blank placeholders untouched', () => {
    const text = 'Found {item} beside {place} and {other}.'
    expect(fillPlaceholders(text, { item: '', place: '   ' })).toBe(
      'Found {item} beside {place} and {other}.',
    )
  })
})

describe('missingFills', () => {
  it('returns placeholder names that are missing or blank', () => {
    const card = makeCard({ placeholders: ['item', 'place', 'bearer'] })
    expect(missingFills(card, { item: 'Lantern', place: '   ' })).toEqual(['place', 'bearer'])
    expect(missingFills(card, { item: 'Lantern', place: 'Basalt Gate', bearer: 'Kael' })).toEqual([])
    expect(missingFills(makeCard({ placeholders: [] }), {})).toEqual([])
  })
})

describe('buildRevealDoc', () => {
  const fills = { item: 'a silver chime', place: 'the lower vault' }
  const card = makeCard()

  it('never includes DM-only or card-identity fields at any stage', () => {
    const cases: Array<{ stage: RevealStage; shown: { more: boolean } }> = [
      { stage: 'image', shown: { more: false } },
      { stage: 'text', shown: { more: false } },
      { stage: 'more', shown: { more: true } },
      { stage: 'closed', shown: { more: true } },
    ]

    for (const { stage, shown } of cases) {
      const doc = buildRevealDoc(card, stage, 'rev-1', card.imageUrl, fills, shown)
      for (const key of FORBIDDEN_REVEAL_KEYS) {
        expect(key in doc).toBe(false)
      }
      const serialized = JSON.stringify(doc)
      expect(serialized).not.toContain(card.dmTruth)
      expect(serialized).not.toContain(card.readAloud)
      expect(serialized).not.toContain('silver chime')
      expect(serialized).not.toContain(card.id)
      expect(serialized).not.toContain(card.imagePrompt)
    }
  })

  it('reveals title and imageUrl at image and text stages, never includes readAloud, and reveals push from more', () => {
    const atImage = buildRevealDoc(card, 'image', 'rev-1', card.imageUrl, fills, {
      more: false,
    })
    expect(atImage).toEqual({
      revealId: 'rev-1',
      stage: 'image',
      title: card.title,
      imageUrl: card.imageUrl,
    })
    expect('readAloud' in atImage).toBe(false)
    expect('push' in atImage).toBe(false)

    // Even if shown flags were set prematurely, image stage never leaks push or readAloud.
    const guardedImage = buildRevealDoc(card, 'image', 'rev-1', card.imageUrl, fills, {
      more: true,
    })
    expect('readAloud' in guardedImage).toBe(false)
    expect('push' in guardedImage).toBe(false)

    const atText = buildRevealDoc(card, 'text', 'rev-1', card.imageUrl, fills, {
      more: false,
    })
    expect(atText).toEqual({
      revealId: 'rev-1',
      stage: 'text',
      title: card.title,
      imageUrl: card.imageUrl,
    })
    expect('readAloud' in atText).toBe(false)
    expect('push' in atText).toBe(false)

    // Even if shown.more were true, text stage never leaks push or readAloud.
    const guardedText = buildRevealDoc(card, 'text', 'rev-1', card.imageUrl, fills, {
      more: true,
    })
    expect('readAloud' in guardedText).toBe(false)
    expect('push' in guardedText).toBe(false)

    const atMore = buildRevealDoc(card, 'more', 'rev-1', card.imageUrl, fills, {
      more: true,
    })
    expect(atMore).toEqual({
      revealId: 'rev-1',
      stage: 'more',
      title: card.title,
      imageUrl: card.imageUrl,
      push: card.push,
    })
    expect('readAloud' in atMore).toBe(false)
  })

  it('keeps previously shown push when closed and omits unshown or empty push', () => {
    const closedWithoutMore = buildRevealDoc(card, 'closed', 'rev-1', null, fills, {
      more: false,
    })
    expect(closedWithoutMore).toEqual({
      revealId: 'rev-1',
      stage: 'closed',
      title: card.title,
      imageUrl: null,
    })
    expect('readAloud' in closedWithoutMore).toBe(false)
    expect('push' in closedWithoutMore).toBe(false)

    const closedWithMore = buildRevealDoc(card, 'closed', 'rev-1', null, fills, {
      more: true,
    })
    expect(closedWithMore).toEqual({
      revealId: 'rev-1',
      stage: 'closed',
      title: card.title,
      imageUrl: null,
      push: card.push,
    })
    expect('readAloud' in closedWithMore).toBe(false)

    const noPushCard = makeCard({ push: '' })
    const moreEmptyPush = buildRevealDoc(noPushCard, 'more', 'rev-1', null, fills, {
      more: true,
    })
    expect('readAloud' in moreEmptyPush).toBe(false)
    expect('push' in moreEmptyPush).toBe(false)

    const blankPushCard = makeCard({ push: '   ' })
    const moreBlankPush = buildRevealDoc(blankPushCard, 'more', 'rev-1', null, fills, {
      more: true,
    })
    expect('readAloud' in moreBlankPush).toBe(false)
    expect('push' in moreBlankPush).toBe(false)
  })
})

describe('buildNote', () => {
  const fills = { item: 'an obsidian token', place: 'the eastern pier' }
  const card = makeCard()

  it('includes cardId and group, respects shown flags, omits empty push, and excludes dmTruth and readAloud', () => {
    const withoutMore = buildNote(card, 'rev-1', card.imageUrl, fills, { more: false })
    expect(withoutMore).toEqual({
      cardId: card.id,
      group: card.group,
      title: card.title,
      imageUrl: card.imageUrl,
      revealId: 'rev-1',
      counted: true,
    })
    expect('readAloud' in withoutMore).toBe(false)
    expect('push' in withoutMore).toBe(false)

    const withMore = buildNote(card, 'rev-1', card.imageUrl, fills, { more: true })
    expect(withMore).toEqual({
      cardId: card.id,
      group: card.group,
      title: card.title,
      imageUrl: card.imageUrl,
      push: card.push,
      revealId: 'rev-1',
      counted: true,
    })
    expect('readAloud' in withMore).toBe(false)
    expect(withMore.push).toBe(card.push)

    const noPushNote = buildNote(makeCard({ push: '' }), 'rev-1', null, fills, {
      more: true,
    })
    expect('readAloud' in noPushNote).toBe(false)
    expect('push' in noPushNote).toBe(false)

    for (const key of ['dmTruth', 'readAloud', 'id', 'trigger', 'tier', 'source', 'imagePrompt']) {
      expect(key in withMore).toBe(false)
    }
    expect(JSON.stringify(withMore)).not.toContain(card.dmTruth)
    expect(JSON.stringify(withMore)).not.toContain('an obsidian token')
  })

  it('sets counted to false on notes built from adHoc cards', () => {
    const adHocNote = buildNote(makeCard({ adHoc: true }), 'rev-2', null, fills, {
      more: false,
    })
    expect(adHocNote.counted).toBe(false)
    expect('readAloud' in adHocNote).toBe(false)
  })
})

describe('nextQueueItem and waitingCount', () => {
  it('returns null and 0 when no live or waiting items exist', () => {
    const items: LoreQueueItem[] = [
      makeQueueItem({ id: 'd1', status: 'done' }),
      makeQueueItem({ id: 's1', status: 'skipped' }),
      makeQueueItem({ id: 'x1', status: 'dismissed' }),
    ]
    expect(nextQueueItem([])).toBeNull()
    expect(waitingCount([])).toBe(0)
    expect(nextQueueItem(items)).toBeNull()
    expect(waitingCount(items)).toBe(0)
  })

  it('prefers the live item over any waiting item and counts all waiting items', () => {
    const live = makeQueueItem({ id: 'live-1', status: 'live', manual: false, order: 99, createdAtMs: 9999 })
    const w1 = makeQueueItem({ id: 'w-1', status: 'waiting', manual: true, order: 0, createdAtMs: 100 })
    const w2 = makeQueueItem({ id: 'w-2', status: 'waiting', manual: false, order: 1, createdAtMs: 200 })
    const done = makeQueueItem({ id: 'd-1', status: 'done' })

    const items = [w1, done, live, w2]
    expect(nextQueueItem(items)?.id).toBe('live-1')
    expect(waitingCount(items)).toBe(2)
  })

  it('orders eligible waiting items by manual, immediate, ready, then order, then createdAtMs', () => {
    const autoBestOrder = makeQueueItem({
      id: 'auto-0',
      status: 'waiting',
      manual: false,
      ready: true,
      order: 0,
      createdAtMs: 10,
    })
    const manualLaterOrder = makeQueueItem({
      id: 'manual-5',
      status: 'waiting',
      manual: true,
      order: 5,
      createdAtMs: 500,
    })
    const manualLowerOrderLaterTime = makeQueueItem({
      id: 'manual-1-late',
      status: 'waiting',
      manual: true,
      order: 1,
      createdAtMs: 300,
    })
    const manualLowerOrderEarlierTime = makeQueueItem({
      id: 'manual-1-early',
      status: 'waiting',
      manual: true,
      order: 1,
      createdAtMs: 200,
    })

    const items = [
      autoBestOrder,
      manualLaterOrder,
      manualLowerOrderLaterTime,
      manualLowerOrderEarlierTime,
    ]
    const originalIds = items.map((item) => item.id)

    expect(nextQueueItem(items)?.id).toBe('manual-1-early')
    expect(waitingCount(items)).toBe(3)
    expect(items.map((item) => item.id)).toEqual(originalIds)

    const remaining = items.filter((item) => item.id !== 'manual-1-early')
    expect(nextQueueItem(remaining)?.id).toBe('manual-1-late')
    expect(waitingCount(remaining)).toBe(2)

    const afterManual = [autoBestOrder, makeQueueItem({ id: 'auto-2', ready: true, order: 2, createdAtMs: 5 })]
    expect(nextQueueItem(afterManual)?.id).toBe('auto-0')
    expect(waitingCount(afterManual)).toBe(1)
  })

  it('never returns a waiting item that is not ready, manual, or immediate', () => {
    const unready1 = makeQueueItem({ id: 'u-1', status: 'waiting', manual: false, order: 0, createdAtMs: 10 })
    const unready2 = makeQueueItem({
      id: 'u-2',
      status: 'waiting',
      manual: false,
      ready: false,
      immediate: false,
      order: 1,
      createdAtMs: 20,
    })

    expect(nextQueueItem([unready1, unready2])).toBeNull()
    expect(waitingCount([unready1, unready2])).toBe(2)
  })

  it('prefers manual over immediate and immediate over ready', () => {
    const readyFirst = makeQueueItem({ id: 'ready-0', ready: true, order: 0, createdAtMs: 10 })
    const immediateItem = makeQueueItem({ id: 'imm-5', immediate: true, order: 5, createdAtMs: 100 })
    const manualItem = makeQueueItem({ id: 'man-9', manual: true, order: 9, createdAtMs: 200 })

    expect(nextQueueItem([readyFirst, immediateItem])?.id).toBe('imm-5')
    expect(waitingCount([readyFirst, immediateItem])).toBe(1)

    expect(nextQueueItem([readyFirst, immediateItem, manualItem])?.id).toBe('man-9')
    expect(waitingCount([readyFirst, immediateItem, manualItem])).toBe(2)
  })
})
