// Basalt Echoes: every boon, Evolution, Combination and hidden boon a
// character has ever held in a run. Rather than hooking each path that puts a
// boon into a slot (drafts, the Starting Boon, wildcard offers, the Forge,
// Reprieve, hidden offers, DM edits), the store calls recordEchoes every time
// run state is saved. Every pick is saved before it can be replaced, so
// replaced boons are still caught.
import type { RunState } from '../model/run'
import { boonsIn, type Slot, type SlotContent } from './boons'

export interface Echoes {
  boons: string[]
  evolutions: string[]
  combinations: string[]
  hidden: string[]
}

export const emptyEchoes = (): Echoes => ({
  boons: [],
  evolutions: [],
  combinations: [],
  hidden: [],
})

const unique = (ids: string[]): string[] => [...new Set(ids)]

/** Echoes from one player's currently held slots and hidden boon. */
export function echoesOf(slots: Slot[] | undefined, hiddenBoonId?: string | null): Echoes {
  const held = (slots ?? []).filter((s): s is SlotContent => s !== null)
  return {
    boons: unique(held.flatMap(boonsIn)),
    evolutions: unique(held.filter((s) => s.kind === 'evolution').map((s) => s.evolutionId)),
    combinations: unique(held.filter((s) => s.kind === 'combination').map((s) => s.combinationId)),
    hidden: hiddenBoonId ? [hiddenBoonId] : [],
  }
}

/** Union two Echoes records per group, keeping first-seen order without duplicates. */
export function mergeEchoes(a: Echoes | undefined | null, b: Echoes | undefined | null): Echoes {
  return {
    boons: unique([...(a?.boons ?? []), ...(b?.boons ?? [])]),
    evolutions: unique([...(a?.evolutions ?? []), ...(b?.evolutions ?? [])]),
    combinations: unique([...(a?.combinations ?? []), ...(b?.combinations ?? [])]),
    hidden: unique([...(a?.hidden ?? []), ...(b?.hidden ?? [])]),
  }
}

function sameEchoes(a: Echoes | undefined, b: Echoes): boolean {
  const sameList = (x: string[] | undefined, y: string[]) =>
    (x?.length ?? 0) === y.length && y.every((id, i) => x?.[i] === id)
  return (
    sameList(a?.boons, b.boons) &&
    sameList(a?.evolutions, b.evolutions) &&
    sameList(a?.combinations, b.combinations) &&
    sameList(a?.hidden, b.hidden)
  )
}

/** Fold each player's current slots and hidden boon into their running echoes for this run. */
export function recordEchoes(state: RunState): RunState {
  let changed = false
  const players = state.players.map((p) => {
    const echoes = mergeEchoes(p.echoes, echoesOf(p.slots, p.hiddenBoonId))
    if (sameEchoes(p.echoes, echoes)) return p
    changed = true
    return { ...p, echoes }
  })
  return changed ? { ...state, players } : state
}
