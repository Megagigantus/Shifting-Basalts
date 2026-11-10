// Thils's Vault (design bible: Thils's Vault: relics, Loot defaults). A full
// clear opens it: every surviving player drafts one relic.
import relicData from '../data/relics.json'
import classTagData from '../data/class-tags.json'
import type { RunPlayer, RunState } from '../model/run'
import type { Random } from './draft'
import { slotTags } from './boons'
import { entryTier, relicOf } from './loot'

export const RELICS = relicData.relics
const WEIGHTS = classTagData.weights

/** Relics anyone in the party already owns never appear. */
function partyRelics(state: RunState): Set<string> {
  const owned = new Set<string>()
  for (const p of state.players) {
    for (const id of p.relicsOwned ?? []) owned.add(id)
    if (p.vaultRelic) owned.add(p.vaultRelic)
  }
  return owned
}

/** A relic's weight for this player: class primary ×3 or secondary ×2, ×2 if they hold one of its tags. */
export function relicWeight(relicId: string, player: Pick<RunPlayer, 'draftProfile' | 'slots'>): number {
  const relic = relicOf(relicId)
  const classId = player.draftProfile?.classId ?? ''
  const favored = player.draftProfile?.favoredTags ?? []
  const row = classTagData.classes.find((c) => c.classId === classId)
  const held = new Set((player.slots ?? []).flatMap((s) => (s ? slotTags(s) : [])))
  let classFactor = 1
  for (const tag of relic.tags) {
    if (row?.primary.includes(tag) || favored.includes(tag)) classFactor = Math.max(classFactor, WEIGHTS.primaryTag)
    else if (row?.secondary.includes(tag)) classFactor = Math.max(classFactor, WEIGHTS.secondaryTag)
  }
  const heldFactor = relic.tags.some((t) => held.has(t)) ? WEIGHTS.heldTag : 1
  return WEIGHTS.base * classFactor * heldFactor
}

function weightedPick(ids: string[], weight: (id: string) => number, random: Random): string {
  const total = ids.reduce((s, id) => s + weight(id), 0)
  let r = random() * total
  for (const id of ids) {
    r -= weight(id)
    if (r < 0) return id
  }
  return ids[ids.length - 1]
}

/** Relics come Dormant at entry 5 to 10 and Woken from entry 11. */
export function relicStateFor(partyLevel: number): 'dormant' | 'woken' {
  return entryTier(partyLevel) >= relicData.wokenFromTier ? 'woken' : 'dormant'
}

/** Open the Vault: each surviving player gets 3 relic offers (4 at entry 17 to 20). */
export function openVault(state: RunState, random: Random): RunState {
  const count = entryTier(state.run.partyLevel) === 3 ? relicData.offersAtTier3 : relicData.offers
  const excluded = partyRelics(state)
  const offeredSoFar = new Set<string>()
  const players = state.players.map((p) => {
    if (!p.alive) return p
    // Keep offers different between players while the pool allows.
    const fresh = RELICS.map((r) => r.id).filter((id) => !excluded.has(id) && !offeredSoFar.has(id))
    const pool = fresh.length >= count ? fresh : RELICS.map((r) => r.id).filter((id) => !excluded.has(id))
    const offer: string[] = []
    while (offer.length < Math.min(count, pool.length)) {
      const id = weightedPick(pool.filter((x) => !offer.includes(x)), (x) => relicWeight(x, p), random)
      offer.push(id)
      offeredSoFar.add(id)
    }
    return { ...p, vaultOffer: offer, vaultRelic: null }
  })
  return { ...state, run: { ...state.run, vaultOpen: true }, players }
}

/** True while any surviving player still has a relic to choose. */
export const vaultPending = ({ run, players }: RunState) =>
  Boolean(run.vaultOpen) && players.some((p) => p.alive && p.vaultOffer?.length)

/** A player takes one of their offered relics. */
export function chooseRelic(state: RunState, characterId: string, relicId: string): RunState {
  if (!state.run.vaultOpen) throw new Error('Thils\'s Vault isn\'t open.')
  const player = state.players.find((p) => p.characterId === characterId)
  if (!player) throw new Error('That character isn\'t in this run.')
  if (!player.alive) throw new Error(`${player.name} fell before the Vault.`)
  if (!player.vaultOffer?.includes(relicId)) throw new Error('That relic isn\'t in their offer.')
  if (state.players.some((p) => p.vaultRelic === relicId)) {
    throw new Error(`${relicOf(relicId).name} was already taken. Pick another.`)
  }
  return {
    ...state,
    players: state.players.map((p) => (p.characterId === characterId ? { ...p, vaultRelic: relicId, vaultOffer: null } : p)),
  }
}
