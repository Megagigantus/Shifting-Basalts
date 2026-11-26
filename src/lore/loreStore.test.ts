import { describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ db: null }))

const { DEFAULT_LORE_SETTINGS, mergeLoreState } = await import('./loreStore')

describe('mergeLoreState', () => {
  it('uses the deck file settings and ignores settings saved in the database', () => {
    const state = mergeLoreState({
      settings: { tierLimit: 'open', deepPerRun: 5, anchor: { name: 'Someone else', voiceNote: 'old' } },
      seen: { 'arr-welcome': 123 },
    })

    expect(state.settings).toEqual(DEFAULT_LORE_SETTINGS)
    expect(state.seen).toEqual({ 'arr-welcome': 123 })
  })

  it('drops seen entries that are not timestamps', () => {
    expect(mergeLoreState({ seen: { a: 1, b: 'x' } }).seen).toEqual({ a: 1 })
  })
})
