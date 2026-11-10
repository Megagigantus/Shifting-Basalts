// Boon counters the DM keeps per player (design bible: App requirements >
// Runs; Phase 7 defaults), such as banked echoes or Reaper chain jumps.
import type { RunState } from '../model/run'

const MAX_NAME = 40

function update(state: RunState, characterId: string, change: (c: Record<string, number>) => Record<string, number>): RunState {
  if (state.run.status !== 'active') throw new Error('This run has ended.')
  if (!state.players.some((p) => p.characterId === characterId)) throw new Error('That character isn\'t in this run.')
  return {
    ...state,
    players: state.players.map((p) => (p.characterId === characterId ? { ...p, counters: change({ ...(p.counters ?? {}) }) } : p)),
  }
}

/** Set (or add) a named counter. Values are whole numbers, 0 or more. */
export function setCounter(state: RunState, characterId: string, name: string, value: number): RunState {
  const label = name.trim()
  if (!label) throw new Error('Give the counter a name.')
  if (label.length > MAX_NAME) throw new Error(`Keep counter names under ${MAX_NAME} characters.`)
  if (!Number.isInteger(value) || value < 0) throw new Error('Counters are whole numbers, 0 or more.')
  return update(state, characterId, (c) => ({ ...c, [label]: value }))
}

export function removeCounter(state: RunState, characterId: string, name: string): RunState {
  return update(state, characterId, (c) => {
    delete c[name]
    return c
  })
}
