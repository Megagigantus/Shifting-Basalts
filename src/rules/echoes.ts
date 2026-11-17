// Basalt Echoes: every boon, Evolution, Combination and hidden boon a
// character has ever held in a run. Rather than hooking each path that puts a
// boon into a slot (drafts, the Starting Boon, wildcard offers, the Forge,
// Reprieve, hidden offers, DM edits), the store calls recordEchoes every time
// run state is saved. Every pick is saved before it can be replaced, so
// replaced boons are still caught.
import type { RunState } from '../model/run'
import type { HiddenBoon } from '../data/types'
import { BOONS, boonsIn, COMBINATIONS, EVOLUTIONS, HIDDEN_BOONS, type Slot, type SlotContent } from './boons'

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

// ---------------------------------------------------------------------------
// The collection: what a character can see in each group, and how much of it
// they have. Totals come from the data files, so new content counts itself.

export type EchoGroup = 'boons' | 'evolutions' | 'combinations' | 'hidden'

/** Hidden boons a character can ever receive: Thils's gifts plus their own classes' hidden boons. */
export function hiddenPoolFor(c: { classId: string; secondClassId?: string }): HiddenBoon[] {
  return HIDDEN_BOONS.filter((h) => h.kind === 'gift' || (h.classId !== undefined && (h.classId === c.classId || h.classId === c.secondClassId)))
}

/** Every id in each group of this character's collection. */
export function echoPool(c: { classId: string; secondClassId?: string }): Record<EchoGroup, string[]> {
  return {
    boons: BOONS.map((b) => b.id),
    evolutions: EVOLUTIONS.map((e) => e.id),
    combinations: COMBINATIONS.map((x) => x.id),
    hidden: hiddenPoolFor(c).map((h) => h.id),
  }
}

/** Seen and total per group, plus overall. Only ids still in the data count as seen. */
export function echoCounts(
  c: { classId: string; secondClassId?: string; echoes?: Echoes },
): Record<EchoGroup | 'overall', { seen: number; total: number }> {
  const pool = echoPool(c)
  const count = (group: EchoGroup) => {
    const seen = new Set(c.echoes?.[group] ?? [])
    return { seen: pool[group].filter((id) => seen.has(id)).length, total: pool[group].length }
  }
  const groups = { boons: count('boons'), evolutions: count('evolutions'), combinations: count('combinations'), hidden: count('hidden') }
  const all = Object.values(groups)
  return { ...groups, overall: { seen: all.reduce((s, g) => s + g.seen, 0), total: all.reduce((s, g) => s + g.total, 0) } }
}

/**
 * Player-facing counts: hidden total equals hidden seen so unfound hidden
 * boons are not spoiled, and overall total uses that hidden total.
 */
export function visibleEchoCounts(
  c: { classId: string; secondClassId?: string; echoes?: Echoes },
): Record<EchoGroup | 'overall', { seen: number; total: number }> {
  const counts = echoCounts(c)
  const hidden = { seen: counts.hidden.seen, total: counts.hidden.seen }
  return {
    ...counts,
    hidden,
    overall: {
      seen: counts.overall.seen,
      total: counts.boons.total + counts.evolutions.total + counts.combinations.total + hidden.total,
    },
  }
}

/**
 * True only when the character has seen every entry in their true collection
 * (including hidden boons), so full-collection status never triggers early
 * without spoiling how many hidden boons exist.
 */
export function hasFullCollection(c: { classId: string; secondClassId?: string; echoes?: Echoes }): boolean {
  const { overall } = echoCounts(c)
  return overall.total > 0 && overall.seen === overall.total
}
