// Thils's Vault (design bible: Thils's Vault: relics, Loot defaults). A full
// clear opens it: every surviving player drafts one relic.
import relicData from '../data/relics.json'
import classTagData from '../data/class-tags.json'
import type { Character, OwnedLoot } from '../model/character'
import type { RunPlayer, RunState } from '../model/run'
import { classFactor, type Random } from './draft'
import { slotTags } from './boons'
import { entryTier, relicOf } from './loot'

export const RELICS = relicData.relics
const WEIGHTS = classTagData.weights

/** Relics this character already owns going into the Vault. */
export function heldRelics(player: Pick<RunPlayer, 'relicsOwned'>): string[] {
  return player.relicsOwned ?? []
}

/** True when the character already owns the maximum number of Vault relics and must trade in or pass. */
export function mustTradeOrPass(player: Pick<RunPlayer, 'relicsOwned'>): boolean {
  return heldRelics(player).length >= relicData.relicsPerCharacter
}

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
  const profile = player.draftProfile
  const held = new Set((player.slots ?? []).flatMap((s) => (s ? slotTags(s) : [])))
  // Same class factors as boon offers (multiclass and homebrew included).
  const factor = Math.max(1, ...relic.tags.map((tag) => classFactor(tag, profile?.classId ?? '', profile?.favoredTags ?? [], profile?.tagWeights)))
  const heldFactor = relic.tags.some((t) => held.has(t)) ? WEIGHTS.heldTag : 1
  return WEIGHTS.base * factor * heldFactor
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

/** Relics come Dormant at entry 5 to 10 and Awoken from entry 11. */
export function relicStateFor(partyLevel: number): 'dormant' | 'woken' {
  return entryTier(partyLevel) >= relicData.wokenFromTier ? 'woken' : 'dormant'
}

/** Line shown on a Dormant Vault card back explaining how to wake the relic. */
export function wakeLine(): string {
  return relicData.wakeText
    .replace('{level}', String(relicData.wakeLevel))
    .replace('{cost}', String(relicData.wakeCostQuantumBasalts))
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
    return { ...p, vaultOffer: offer, vaultRelic: null, vaultPassed: false, vaultTradeIn: null }
  })
  return { ...state, run: { ...state.run, vaultOpen: true }, players }
}

/** True while any surviving player still has a relic to choose. */
export const vaultPending = ({ run, players }: RunState) =>
  Boolean(run.vaultOpen) && players.some((p) => p.alive && !p.vaultPassed && p.vaultOffer?.length)

/** A player takes one of their offered relics (trading in their held relic if at the limit). */
export function chooseRelic(state: RunState, characterId: string, relicId: string): RunState {
  if (!state.run.vaultOpen) throw new Error('Thils\'s Vault isn\'t open.')
  const player = state.players.find((p) => p.characterId === characterId)
  if (!player) throw new Error('That character isn\'t in this run.')
  if (!player.alive) throw new Error(`${player.name} fell before the Vault.`)
  if (!player.vaultOffer?.includes(relicId)) throw new Error('That relic isn\'t in their offer.')
  if (state.players.some((p) => p.vaultRelic === relicId)) {
    throw new Error(`${relicOf(relicId).name} was already taken. Pick another.`)
  }
  const vaultTradeIn = mustTradeOrPass(player) ? [...heldRelics(player)] : null
  return {
    ...state,
    players: state.players.map((p) =>
      p.characterId === characterId ? { ...p, vaultRelic: relicId, vaultOffer: null, vaultTradeIn } : p,
    ),
  }
}

/** A relic owner passes the Vault for a flat Quantum Basalts payout. */
export function passVault(state: RunState, characterId: string): RunState {
  if (!state.run.vaultOpen) throw new Error('Thils\'s Vault isn\'t open.')
  const player = state.players.find((p) => p.characterId === characterId)
  if (!player) throw new Error('That character isn\'t in this run.')
  if (!player.alive) throw new Error(`${player.name} fell before the Vault.`)
  if (!mustTradeOrPass(player)) throw new Error('Only a character who already owns a relic can pass the Vault.')
  if (player.vaultRelic || player.vaultPassed || !player.vaultOffer?.length) {
    throw new Error(`${player.name} already chose in the Vault.`)
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.characterId === characterId
        ? {
            ...p,
            vaultPassed: true,
            vaultOffer: null,
            vaultRelic: null,
            vaultTradeIn: null,
            quantumBasaltsPassed: p.quantumBasaltsPassed + relicData.passQuantumBasalts,
          }
        : p,
    ),
  }
}

// ---------------------------------------------------------------------------
// Waking a Dormant relic (Thils's Vault: relics): its bearer reaches the wake
// level and offers Quantum Basalts at a shrine to Thils. The shrine itself is
// checked where the offering is made (rules/loot.ts shrineHereThils).

type Bearer = Pick<Character, 'level' | 'bankedQuantumBasalts' | 'loot'>

export const WAKE_LEVEL = relicData.wakeLevel
export const WAKE_COST = relicData.wakeCostQuantumBasalts

/** The bearer's Dormant relics. */
export function dormantRelics(c: Bearer): OwnedLoot[] {
  return (c.loot ?? []).filter((i) => i.kind === 'relic' && i.relicState !== 'woken')
}

/** Why this relic can't wake right now, or null if it can. */
export function wakeBlocker(c: Bearer, relicId: string): string | null {
  if (!dormantRelics(c).some((i) => i.ref === relicId)) return 'That relic isn\'t a Dormant relic this character carries.'
  if (c.level < WAKE_LEVEL) return `A relic wakes once its bearer reaches level ${WAKE_LEVEL}.`
  if (c.bankedQuantumBasalts < WAKE_COST) return `Waking it takes ${WAKE_COST} banked Quantum Basalts.`
  return null
}

/** Wake a Dormant relic: spends the Basalts and returns the changed fields. */
export function wakeRelic(c: Bearer, relicId: string): { bankedQuantumBasalts: number; loot: OwnedLoot[] } {
  const blocker = wakeBlocker(c, relicId)
  if (blocker) throw new Error(blocker)
  return {
    bankedQuantumBasalts: c.bankedQuantumBasalts - WAKE_COST,
    loot: (c.loot ?? []).map((i) => (i.kind === 'relic' && i.ref === relicId ? { ...i, relicState: 'woken' as const } : i)),
  }
}
