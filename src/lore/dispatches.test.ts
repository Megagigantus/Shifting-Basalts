import { describe, expect, it } from 'vitest'
import {
  adHocAnswerCard,
  askedThisRoom,
  dispatchFromDoc,
  dueDispatches,
  newAdHocId,
  type LoreDispatch,
} from './dispatches'

function makeDispatch(overrides: Partial<LoreDispatch> = {}): LoreDispatch {
  return {
    id: 'disp-1',
    question: 'Who built the gate?',
    runId: 'run-1',
    floor: 1,
    status: 'pending',
    createdAtMs: 1000,
    ...overrides,
  }
}

describe('dispatchFromDoc', () => {
  it('maps valid pending and answered dispatch fields including answerCardId', () => {
    const pending = dispatchFromDoc('d-1', {
      question: 'Why does the stair shift?',
      runId: 'run-42',
      floor: 2,
      status: 'pending',
      createdAtMs: 5500,
    })
    expect(pending).toEqual({
      id: 'd-1',
      question: 'Why does the stair shift?',
      runId: 'run-42',
      floor: 2,
      status: 'pending',
      createdAtMs: 5500,
    })
    expect('answerCardId' in pending).toBe(false)

    const answered = dispatchFromDoc('d-2', {
      question: 'What is Thils?',
      runId: 'run-42',
      floor: 1,
      status: 'answered',
      createdAtMs: 4200,
      answerCardId: 'dis-thils',
    })
    expect(answered).toEqual({
      id: 'd-2',
      question: 'What is Thils?',
      runId: 'run-42',
      floor: 1,
      status: 'answered',
      createdAtMs: 4200,
      answerCardId: 'dis-thils',
    })
  })

  it('defaults unknown status to pending and extracts createdAtMs from Timestamp-like objects or 0', () => {
    const unknownStatus = dispatchFromDoc('d-3', {
      question: 'Hello?',
      runId: 'run-1',
      floor: 3,
      status: 'bogus',
      createdAt: { toMillis: () => 9876 },
    })
    expect(unknownStatus.status).toBe('pending')
    expect(unknownStatus.createdAtMs).toBe(9876)

    const missingFields = dispatchFromDoc('d-4', {
      createdAtMs: Number.NaN,
      createdAt: { toMillis: () => 'bad' },
    })
    expect(missingFields).toEqual({
      id: 'd-4',
      question: '',
      runId: '',
      floor: 0,
      status: 'pending',
      createdAtMs: 0,
    })
  })
})

describe('askedThisRoom', () => {
  const dispatches: LoreDispatch[] = [
    makeDispatch({ id: 'd-1', runId: 'run-1', floor: 1 }),
    makeDispatch({ id: 'd-2', runId: 'run-1', floor: 2, status: 'answered' }),
    makeDispatch({ id: 'd-3', runId: 'run-2', floor: 3 }),
  ]

  it('returns the dispatch for the matching run and floor, or null if none exists', () => {
    expect(askedThisRoom(dispatches, 'run-1', 1)?.id).toBe('d-1')
    expect(askedThisRoom(dispatches, 'run-1', 2)?.id).toBe('d-2')
    expect(askedThisRoom(dispatches, 'run-1', 3)).toBeNull()
    expect(askedThisRoom(dispatches, 'run-2', 1)).toBeNull()
    expect(askedThisRoom([], 'run-1', 1)).toBeNull()
  })
})

describe('dueDispatches', () => {
  const f1Newer = makeDispatch({ id: 'f1-late', runId: 'run-1', floor: 1, createdAtMs: 3000 })
  const f1Older = makeDispatch({ id: 'f1-early', runId: 'run-1', floor: 1, createdAtMs: 1000 })
  const f2Pending = makeDispatch({ id: 'f2-pend', runId: 'run-1', floor: 2, createdAtMs: 2000 })
  const f3Current = makeDispatch({ id: 'f3-curr', runId: 'run-1', floor: 3, createdAtMs: 4000 })
  const f1Answered = makeDispatch({
    id: 'f1-ans',
    runId: 'run-1',
    floor: 1,
    status: 'answered',
    createdAtMs: 500,
    answerCardId: 'dis-1',
  })
  const otherRun = makeDispatch({ id: 'other', runId: 'run-2', floor: 1, createdAtMs: 100 })

  const all = [f1Newer, f3Current, f1Answered, otherRun, f2Pending, f1Older]

  it('returns only earlier-floor pending dispatches of the run when active, oldest first', () => {
    const originalIds = all.map((d) => d.id)
    const due = dueDispatches(all, 'run-1', 3, false)
    expect(due.map((d) => d.id)).toEqual(['f1-early', 'f2-pend', 'f1-late'])
    expect(all.map((d) => d.id)).toEqual(originalIds)
  })

  it('returns all pending dispatches of the run when the run has ended, oldest first', () => {
    const due = dueDispatches(all, 'run-1', 3, true)
    expect(due.map((d) => d.id)).toEqual(['f1-early', 'f2-pend', 'f1-late', 'f3-curr'])
  })

  it('excludes answered dispatches and dispatches from other runs', () => {
    expect(dueDispatches([f1Answered, otherRun], 'run-1', 5, true)).toEqual([])
    expect(dueDispatches([f1Answered, otherRun], 'run-1', 5, false)).toEqual([])
  })
})

describe('adHocAnswerCard', () => {
  it('builds a repeatable ad-hoc dispatch card with trimmed and capped label', () => {
    const card = adHocAnswerCard(
      {
        question: '   What happens to striders who never leave the labyrinth?   ',
        title: 'Re: The Unreturned',
        readAloud: 'Dry, clipped - "They stop counting floors."',
        push: 'Some build shrines in the deeper alcoves.',
        dmTruth: 'Generational locals descend from early striders.',
        tier: 'guarded',
      },
      'dis-adhoc-ab12cd34',
    )

    expect(card).toEqual({
      id: 'dis-adhoc-ab12cd34',
      group: 'dispatch',
      title: 'Re: The Unreturned',
      trigger: {
        key: 'dispatch',
        label: 'Answer to: What happens to striders who never leave the labyrinth?',
      },
      repeat: 'repeatable',
      tier: 'guarded',
      source: 'loremaster',
      readAloud: 'Dry, clipped - "They stop counting floors."',
      push: 'Some build shrines in the deeper alcoves.',
      dmTruth: 'Generational locals descend from early striders.',
      placeholders: [],
      imageUrl: null,
      adHoc: true,
    })
  })

  it('caps trigger.label at 120 characters after trimming', () => {
    const longQuestion = `   ${'x'.repeat(200)}   `
    const card = adHocAnswerCard(
      {
        question: longQuestion,
        title: 'Re: Long Query',
        readAloud: 'Brief.',
        push: '',
        dmTruth: '',
        tier: 'open',
      },
      'dis-adhoc-00000000',
    )

    expect(card.trigger.label.length).toBe(120)
    expect(card.trigger.label).toBe(`Answer to: ${'x'.repeat(109)}`)
    expect(card.adHoc).toBe(true)
    expect(card.trigger.key).toBe('dispatch')
  })
})

describe('newAdHocId', () => {
  it('formats dis-adhoc- followed by 8 lowercase letters or digits using the provided random', () => {
    expect(newAdHocId(() => 0)).toBe('dis-adhoc-aaaaaaaa')

    const values = [0, 0.25, 0.5, 0.75, 0.99, 0.1, 0.4, 0.8]
    let i = 0
    const generated = newAdHocId(() => {
      const value = values[i % values.length]
      i += 1
      return value
    })
    expect(generated).toMatch(/^dis-adhoc-[a-z0-9]{8}$/)
    expect(generated).toBe('dis-adhoc-ajs19do2')
  })
})
