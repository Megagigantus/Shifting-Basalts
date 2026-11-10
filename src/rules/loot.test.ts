import { describe, expect, it } from 'vitest'
import { emptyDungeonLayer, emptyProfile, type Character } from '../model/character'
import type { RunState } from '../model/run'
import {
  bossCache,
  cacheRolls,
  entryTier,
  floorRarity,
  floorRoll,
  itemName,
  itemValue,
  keptPercent,
  keptValue,
  partyRewardBonusPercent,
  planShare,
  poolValue,
  rerollableItems,
  roomLoot,
  searchStriderRemains,
  shrineOffering,
  type LootItem,
} from './loot'
import { markDead, newRunState, rewardBonusPercent } from './runFlow'

// mulberry32: neighbouring seeds give unrelated sequences.
function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const char = (id: string, level = 5, upgrades: Record<string, number> = {}): Character => ({
  ...emptyProfile(),
  ...emptyDungeonLayer(),
  id,
  name: id,
  level,
  upgrades,
})

const run = (chars = [char('a'), char('b')], pressures: string[] = []): RunState =>
  newRunState('r', 'X', chars, pressures)

const item = (over: Partial<LootItem>): LootItem => ({
  uid: 'x',
  kind: 'wondrous',
  ref: 'wayward-compass',
  rarity: 'common',
  floor: 1,
  room: 1,
  source: 'room',
  ...over,
})

describe('values and tiers', () => {
  it('prices items by rarity, trinkets at 10, consumables at half, relics at nothing', () => {
    expect(itemValue(item({ kind: 'trinket', ref: '0', rarity: null }))).toBe(10)
    expect(itemValue(item({ kind: 'consumable', ref: 'echo-phial', rarity: 'uncommon' }))).toBe(200)
    expect(itemValue(item({ kind: 'gear', ref: 'columnbreaker', rarity: 'rare' }))).toBe(4000)
    expect(itemValue(item({ kind: 'relic', ref: 'breakers-wraps', rarity: null }))).toBe(0)
  })

  it('names healing potions by grade and gear by bonus', () => {
    expect(itemName(item({ kind: 'consumable', ref: 'healing-potion', rarity: 'rare' }))).toBe('Potion of Superior Healing')
    expect(itemName(item({ kind: 'gear', ref: 'choir-shield', rarity: 'very-rare' }))).toBe('Choir shield +3')
    expect(itemName(item({ kind: 'gear', ref: 'choir-shield', rarity: 'common' }))).toBe('Choir shield')
  })

  it('reads entry tiers from party level', () => {
    expect([entryTier(5), entryTier(10), entryTier(11), entryTier(17)]).toEqual([1, 1, 2, 3])
  })

  it('sets rarity by floor and tier, with the upgrade on a 6', () => {
    expect(floorRarity(1, 5, () => 0)).toBe('common')
    expect(floorRarity(2, 12, () => 0)).toBe('rare')
    expect(floorRarity(3, 5, () => 0.99)).toBe('rare') // d6 = 6
    expect(floorRarity(3, 5, () => 0)).toBe('uncommon')
    expect(floorRarity(4, 18, () => 0.99)).toBe('legendary')
    expect(floorRarity(5, 5, () => 0)).toBe('rare') // floor 5 uses floor 4
  })
})

describe('the party reward bonus', () => {
  it('counts Pressures and 5% per Extra Pressures owner, the same for loot and Basalts', () => {
    const state = run([char('a', 5, { 'extra-pressures': 1 }), char('b', 5, { 'extra-pressures': 1, 'extra-loot': 2 })], ['narrow-seam'])
    expect(partyRewardBonusPercent(state.run)).toBe(15 + 10)
    expect(rewardBonusPercent(state, state.players[1])).toBe(25 + 20)
  })

  it('adds a boss cache roll per full 50%', () => {
    const base = run().run
    expect(cacheRolls(base)).toBe(2)
    expect(cacheRolls({ ...base, pressureBonusPercent: 40, extraPressuresBonusPercent: 10 })).toBe(3)
    expect(cacheRolls({ ...base, pressureBonusPercent: 95, extraPressuresBonusPercent: 0 })).toBe(3)
    expect(cacheRolls({ ...base, pressureBonusPercent: 90, extraPressuresBonusPercent: 10 })).toBe(4)
  })
})

describe('floor rolls', () => {
  it('follow the floor 1 d100 table', () => {
    const counts: Record<string, number> = {}
    const state = run()
    const random = seeded(1)
    for (let i = 0; i < 4000; i++) {
      const d = floorRoll(state.run, 1, random)
      const kind = d.kind === 'item' ? d.item.kind : d.kind
      counts[kind] = (counts[kind] ?? 0) + 1
    }
    expect(counts.credits / 4000).toBeCloseTo(0.25, 1)
    expect(counts.trinket / 4000).toBeCloseTo(0.3, 1)
    expect(counts.basalts / 4000).toBeCloseTo(0.05, 1)
  })

  it('multiply credits by the entry tier and the party bonus, rounded up once', () => {
    // d100 = 1 (credits), then 2d6 both 1: 2 x 10 = 20 credits at tier 1.
    const seq = [0, 0, 0]
    let i = 0
    const random = () => seq[i++] ?? 0
    const state = run([char('a', 12), char('b', 12)], ['brittle-ground'])
    expect(floorRoll(state.run, 1, random)).toEqual({ kind: 'credits', amount: Math.ceil(20 * 2 * 1.1) })
  })

  it('bank loot Basalts for living players only, times the entry multiplier', () => {
    let state = markDead(run(), 'b', () => 1)
    state = { ...state, run: { ...state.run, floor: 4 } }
    let found = false
    for (let seed = 1; seed <= 60 && !found; seed++) {
      const next = roomLoot(state, 'combat', seeded(seed))
      const entry = next.run.loot!.log.find((l) => l.basalts)
      if (entry) {
        found = true
        expect(entry.basalts).toBeGreaterThanOrEqual(3)
        expect(next.players[0].quantumBasaltsEarned).toBe(entry.basalts)
        expect(next.players[1].quantumBasaltsEarned).toBe(0)
      }
    }
    expect(found).toBe(true)
  })
})

describe('room loot and boss caches', () => {
  it('rolls once for combat, twice for elite, never for a Reprieve', () => {
    expect(roomLoot(run(), 'combat', seeded(2)).run.loot!.log).toHaveLength(1)
    expect(roomLoot(run(), 'elite', seeded(2)).run.loot!.log).toHaveLength(2)
    expect(roomLoot(run(), 'reprieve', seeded(2)).run.loot?.log ?? []).toHaveLength(0)
  })

  it('gives a boss cache its rolls, a wondrous item one rarity up, and sometimes the trophy', () => {
    let trophies = 0
    for (let seed = 1; seed <= 300; seed++) {
      const state = bossCache(run(), 'tessellated-warden', seeded(seed))
      const loot = state.run.loot!
      expect(loot.log.filter((l) => l.source === 'cache')).toHaveLength(2)
      const bonus = loot.items.find((i) => i.source === 'cache-bonus')!
      expect(bonus).toMatchObject({ kind: 'wondrous', rarity: 'uncommon' })
      const trophy = loot.items.find((i) => i.source === 'trophy')
      if (trophy) {
        trophies++
        expect(trophy).toMatchObject({ ref: 'wardens-cracked-lens', rarity: 'uncommon' })
      }
    }
    expect(trophies / 300).toBeCloseTo(1 / 3, 1)
  })

  it('floor 5\'s cache uses floor 4\'s tables, its bonus item one rarity above', () => {
    let state = run()
    state = { ...state, run: { ...state.run, floor: 5 } }
    const next = bossCache(state, 'ophaniel', seeded(9))
    expect(next.run.loot!.items.find((i) => i.source === 'cache-bonus')?.rarity).toBe('very-rare')
  })

  it('gives legendary gear a second property', () => {
    let state = run([char('a', 18), char('b', 18)])
    state = { ...state, run: { ...state.run, floor: 4 } }
    for (let seed = 1; seed <= 400; seed++) {
      for (const i of roomLoot(state, 'elite', seeded(seed)).run.loot!.items) {
        if (i.kind === 'gear' && i.rarity === 'legendary') {
          expect(i.secondRef).toBeTruthy()
          expect(i.secondRef).not.toBe(i.ref)
        }
      }
    }
  })
})

describe('strider remains and shrines', () => {
  it('a search gives a trinket, plus a consumable on beating the DC by 5, once per room', () => {
    const once = searchStriderRemains(run(), false, seeded(3))
    expect(once.run.loot!.items.map((i) => i.kind)).toEqual(['trinket'])
    expect(searchStriderRemains(run(), true, seeded(3)).run.loot!.items.map((i) => i.kind)).toEqual(['trinket', 'consumable'])
    expect(() => searchStriderRemains(once, false, seeded(4))).toThrow('already been searched')
  })

  it('a shrine offering spends a trinket to reroll one of this floor\'s rolls', () => {
    const searched = searchStriderRemains(run(), false, seeded(3)) // a trinket (strider: not rerollable)
    const trinket = searched.run.loot!.items.find((i) => i.kind === 'trinket')!
    let state = searched
    for (let seed = 5; rerollableItems(state).length === 0; seed++) {
      expect(seed).toBeLessThan(50)
      state = roomLoot(searched, 'elite', seeded(seed))
    }
    expect(rerollableItems(state).map((i) => i.uid)).not.toContain(trinket.uid)
    const target = rerollableItems(state)[0]
    const next = shrineOffering(state, trinket.uid, target.uid, seeded(6))
    const uids = next.run.loot!.items.map((i) => i.uid)
    expect(uids).not.toContain(trinket.uid)
    expect(uids).not.toContain(target.uid)
    expect(next.run.loot!.log.at(-1)?.source).toBe('shrine')
    expect(() => shrineOffering(state, target.uid, trinket.uid, seeded(6))).toThrow()
  })
})

describe('extraction', () => {
  const withPool = (state: RunState, items: LootItem[], credits = 0): RunState => ({
    ...state,
    run: { ...state.run, lastBossFloor: 1, loot: { items, credits, nextUid: 99, log: [], searched: [] } },
  })

  it('keeps the floor share plus Deep Pockets plus Collector\'s Eye once, at most 100%', () => {
    let state = withPool(run([char('a', 5, { 'deep-pockets': 2 }), char('b')]), [])
    expect(keptPercent(state)).toBe(25 + 10)
    state = { ...state, players: state.players.map((p) => ({ ...p, hiddenBoonId: 'collectors-eye' })) }
    expect(keptPercent(state)).toBe(25 + 10 + 10)
    state = markDead(state, 'a', () => 1)
    expect(keptPercent(state)).toBe(45) // b still holds it
    state = { ...state, run: { ...state.run, lastBossFloor: 5 } }
    expect(keptPercent(state)).toBe(100)
  })

  it('lets the party pick items up to the kept value and pays the rest in credits', () => {
    const items = [
      item({ uid: 'A', kind: 'gear', ref: 'columnbreaker', rarity: 'uncommon' }), // 400
      item({ uid: 'B', kind: 'trinket', ref: '3', rarity: null }), // 10
    ]
    const state = withPool(run(), items, 1590) // pool 2,000; 25% kept = 500
    expect(poolValue(state.run.loot)).toBe(2000)
    expect(keptValue(state)).toBe(500)
    const share = planShare(state, [
      { uid: 'A', characterId: 'a' },
      { uid: 'B', characterId: 'b' },
    ])
    expect(share).toMatchObject({ keptPercent: 25, keptValue: 500, itemsValue: 410, creditsPayout: 90 })
  })

  it('refuses picks over the kept value, repeats and strangers, but allows fallen characters', () => {
    const items = [item({ uid: 'A', kind: 'gear', ref: 'columnbreaker', rarity: 'rare' })]
    const state = markDead(withPool(run(), items, 20000), 'b', () => 1) // 24,000 x 25% = 6,000
    expect(planShare(state, [{ uid: 'A', characterId: 'b' }]).creditsPayout).toBe(2000)
    expect(() => planShare(state, [{ uid: 'A', characterId: 'z' }])).toThrow('characters in this run')
    expect(() => planShare(state, [{ uid: 'A', characterId: 'a' }, { uid: 'A', characterId: 'b' }])).toThrow('twice')
    const poor = withPool(run(), items, 0)
    expect(() => planShare(poor, [{ uid: 'A', characterId: 'a' }])).toThrow('the party keeps 1,000')
  })
})
