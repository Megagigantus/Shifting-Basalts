// Checks the game-content files in src/data for mistakes.
// Run with: npm run check-data
// Exits with an error if anything is wrong, so it can also guard builds.
import { readdirSync, readFileSync } from 'node:fs'
import type { Boon, Combination, Evolution, HiddenBoon } from '../src/data/types.ts'
import { withGeneratedBlock } from './rules-generated.ts'

const TAGS = [
  'Core', 'Echo', 'Reaper', 'Spell', 'Crit', 'Stance', 'Volley', 'Shadow',
  'Rally', 'Guard', 'Bond', 'Flurry', 'Blood', 'Hunt', 'Payoff',
]
const KINDS = ['normal', 'core', 'payoff']
const STATUSES = ['locked', 'proposed']
const TRACKS = [
  'max-hp', 'spell-slot-recovery', 'opening-temp-hp', 'flat-damage',
  'healing-received', 'speed', 'fortune-dice',
]

function load<T>(file: string): T[] {
  const url = new URL(`../src/data/${file}`, import.meta.url)
  // Strip a leading byte order mark, which some Windows editors add.
  const text = readFileSync(url, 'utf8').replace(/^﻿/, '')
  try {
    return JSON.parse(text) as T[]
  } catch (err) {
    console.error(`${file} is not valid JSON: ${(err as Error).message}`)
    process.exit(1)
  }
}

const boons = load<Boon>('boons.json')
const evolutions = load<Evolution>('evolutions.json')
const combinations = load<Combination>('combinations.json')
const hiddenBoons = load<HiddenBoon>('hidden-boons.json')
const classIds = load<{ id: string }>('classes.json').map((c) => c.id)

const errors: string[] = []
const fail = (msg: string) => errors.push(msg)

// Ids must be unique across all three files, since they share one namespace.
const seen = new Map<string, string>()
for (const [file, items] of [
  ['boons.json', boons],
  ['evolutions.json', evolutions],
  ['combinations.json', combinations],
  ['hidden-boons.json', hiddenBoons],
] as const) {
  for (const item of items) {
    if (!item.id || !/^[a-z0-9-]+$/.test(item.id)) {
      fail(`${file}: "${item.name}" has a missing or badly formed id "${item.id}" (use lowercase-with-dashes)`)
    }
    const other = seen.get(item.id)
    if (other) fail(`${file}: id "${item.id}" is already used in ${other}`)
    seen.set(item.id, file)
    if (!item.name) fail(`${file}: "${item.id}" has no name`)
    if (!STATUSES.includes(item.status)) fail(`${file}: "${item.id}" has unknown status "${item.status}"`)
  }
}

const boonById = new Map(boons.map((b) => [b.id, b]))
const evoById = new Map(evolutions.map((e) => [e.id, e]))
const comboById = new Map(combinations.map((c) => [c.id, c]))

for (const b of boons) {
  const where = `boons.json "${b.id}"`
  if (!Array.isArray(b.tags) || b.tags.length === 0) fail(`${where}: needs at least one tag`)
  for (const t of b.tags ?? []) if (!TAGS.includes(t)) fail(`${where}: unknown tag "${t}"`)
  if (!KINDS.includes(b.kind)) fail(`${where}: unknown kind "${b.kind}"`)
  if (!Array.isArray(b.levels) || b.levels.length !== 3 || b.levels.some((l) => !l)) {
    fail(`${where}: needs exactly 3 non-empty level texts`)
  }

  if (b.kind === 'payoff') {
    if (!b.payoffTrack) fail(`${where}: payoff boons need a payoffTrack`)
    else if (!TRACKS.includes(b.payoffTrack)) fail(`${where}: unknown payoffTrack "${b.payoffTrack}"`)
    if (!b.tags.includes('Payoff')) fail(`${where}: payoff boons need the Payoff tag`)
  } else if (b.payoffTrack) {
    fail(`${where}: only payoff boons can have a payoffTrack`)
  }
  if (b.kind === 'core' && !b.tags.includes('Core')) fail(`${where}: core boons need the Core tag`)

  if (b.kind !== 'normal' && (b.evolvesTo || b.combinesWith?.length)) {
    fail(`${where}: ${b.kind} boons never evolve or combine`)
  }

  if (b.evolvesTo) {
    const evo = evoById.get(b.evolvesTo)
    if (!evo) fail(`${where}: evolvesTo "${b.evolvesTo}" is not in evolutions.json`)
    else if (evo.from !== b.id) fail(`${where}: evolvesTo "${evo.id}", but that evolution says it comes from "${evo.from}"`)
  }

  for (const cId of b.combinesWith ?? []) {
    const combo = comboById.get(cId)
    if (!combo) fail(`${where}: combinesWith "${cId}" is not in combinations.json`)
    else if (!combo.boons.includes(b.id)) fail(`${where}: lists combination "${cId}", but that combination doesn't use this boon`)
  }
}

for (const e of evolutions) {
  const where = `evolutions.json "${e.id}"`
  if (!e.effect) fail(`${where}: has no effect text`)
  const source = boonById.get(e.from)
  if (!source) fail(`${where}: from "${e.from}" is not in boons.json`)
  else if (source.evolvesTo !== e.id) fail(`${where}: boon "${e.from}" doesn't list this as its evolvesTo`)
}

for (const c of combinations) {
  const where = `combinations.json "${c.id}"`
  if (!c.effect) fail(`${where}: has no effect text`)
  if (!Array.isArray(c.boons) || c.boons.length !== 2 || c.boons[0] === c.boons[1]) {
    fail(`${where}: needs exactly 2 different boons`)
    continue
  }
  for (const bId of c.boons) {
    const boon = boonById.get(bId)
    if (!boon) fail(`${where}: boon "${bId}" is not in boons.json`)
    else if (!boon.combinesWith?.includes(c.id)) fail(`${where}: boon "${bId}" doesn't list this in its combinesWith`)
  }
}

for (const h of hiddenBoons) {
  const where = `hidden-boons.json "${h.id}"`
  if (!h.effect) fail(`${where}: has no effect text`)
  if (h.kind === 'class') {
    if (!classIds.includes(h.classId ?? '')) fail(`${where}: unknown classId "${h.classId}"`)
    if (!h.condition) fail(`${where}: class hidden boons need a condition`)
  } else if (h.kind !== 'gift') {
    fail(`${where}: kind must be "class" or "gift"`)
  }
}

for (const b of boons) {
  for (const r of b.requires ?? []) {
    if (r !== 'spells' && r !== 'summon') fail(`boons.json "${b.id}": unknown requirement "${r}"`)
  }
}

// class-tags.json: every class has a row, with real tags and no repeats.
const classTags = JSON.parse(
  readFileSync(new URL('../src/data/class-tags.json', import.meta.url), 'utf8').replace(/^﻿/, ''),
) as { classes: { classId: string; primary: string[]; secondary: string[] }[] }
for (const id of classIds) {
  if (!classTags.classes.some((c) => c.classId === id)) fail(`class-tags.json: no row for class "${id}"`)
}
for (const row of classTags.classes) {
  const where = `class-tags.json "${row.classId}"`
  if (!classIds.includes(row.classId)) fail(`${where}: unknown class`)
  const all = [...row.primary, ...row.secondary]
  for (const t of all) if (!TAGS.includes(t)) fail(`${where}: unknown tag "${t}"`)
  if (new Set(all).size !== all.length) fail(`${where}: a tag is listed twice`)
}

// Encounters and bosses (Phase 5).
function loadObject<T>(file: string): T {
  return JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8').replace(/^﻿/, '')) as T
}
interface EnemyData {
  families: { id: string; name: string; floorWeights: Record<string, number>; twist: string }[]
  roles: Record<string, string[]>
  creatures: {
    id: string
    name: string
    family: string
    role: string
    cr: number
    reskin: string
    ac: number
    hp: number
    hpMult: number
    abilities: Record<string, number>
    saves: Record<string, number>
  }[]
}
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const sameKeys = (o: Record<string, unknown> | undefined) =>
  !!o && Object.keys(o).length === 6 && ABILITY_KEYS.every((k) => k in o)
const enemies = loadObject<EnemyData>('enemies.json')
const budgets = loadObject<{
  floors: { floor: number; budget: string }[]
  budgets: { level: number; low: number; moderate: number; high: number }[]
  creatureXp: Record<string, number>
  maxCreatureCr: number
}>('encounter-budgets.json')
const benchmarks = loadObject<{ benchmarks: { cr: number }[] }>('cr-benchmarks.json').benchmarks
const bossData = loadObject<{
  scaling: { floors: { floor: number; proficientSaves: number }[]; abilityBands: { minCr: number; maxCr: number }[] }
  bosses: {
    id: string
    name: string
    floor: number
    abilityRanks: Record<string, string>
    proficientSaves: string[]
    parts?: { name: string }[]
    partProfiles?: Record<string, { abilityRanks: Record<string, string>; proficientSaves: string[] }>
    attacks: { name: string; percent: number; count: number; die?: string }[]
    specials?: { text: string }[]
    legendaryOptions?: { text: string }[]
    shiftAction: { name: string; text: string }
  }[]
}>('bosses.json')

const familyIds = new Set(enemies.families.map((f) => f.id))
const allRoles = Object.values(enemies.roles).flat()
for (const f of enemies.families) {
  for (const floor of Object.keys(f.floorWeights)) {
    if (!['1', '2', '3', '4'].includes(floor)) fail(`enemies.json family "${f.id}": unknown floor "${floor}"`)
  }
}
for (let floor = 1; floor <= 4; floor++) {
  if (!enemies.families.some((f) => f.floorWeights[floor])) fail(`enemies.json: no family appears on floor ${floor}`)
}
const creatureIds = new Set<string>()
for (const c of enemies.creatures) {
  const where = `enemies.json creature "${c.id}"`
  if (creatureIds.has(c.id)) fail(`${where}: id used twice`)
  creatureIds.add(c.id)
  if (!familyIds.has(c.family)) fail(`${where}: unknown family "${c.family}"`)
  if (!allRoles.includes(c.role)) fail(`${where}: role "${c.role}" isn't listed in roles`)
  if (budgets.creatureXp[String(c.cr)] === undefined) fail(`${where}: no XP value for CR ${c.cr}`)
  if (!(c.ac > 0) || !(c.hp > 0) || !(c.hpMult > 0)) fail(`${where}: needs ac, hp and hpMult`)
  if (!sameKeys(c.abilities) || !sameKeys(c.saves)) fail(`${where}: abilities and saves need str, dex, con, int, wis and cha`)
}
for (const f of enemies.families) {
  if (!enemies.creatures.some((c) => c.family === f.id)) fail(`enemies.json family "${f.id}": has no creatures`)
}
budgets.budgets.forEach((row, i) => {
  if (row.level !== i + 1) fail(`encounter-budgets.json: budget rows must run 1, 2, 3... (row ${i + 1} says ${row.level})`)
})
for (let cr = 1; cr <= budgets.maxCreatureCr; cr++) {
  if (budgets.creatureXp[String(cr)] === undefined) fail(`encounter-budgets.json: no XP value for CR ${cr}`)
}
// An optional CR 1/2 row first, then CR 1, 2, 3...
const wholeRows = benchmarks[0]?.cr === 0.5 ? benchmarks.slice(1) : benchmarks
wholeRows.forEach((row, i) => {
  if (row.cr !== i + 1) fail(`cr-benchmarks.json: rows must run CR 1/2 (optional), 1, 2, 3... (found ${row.cr} where ${i + 1} belongs)`)
})
const bossIds = new Set<string>()
const PLACEHOLDER = /\{([a-z]+)(?::[\d.]+(?::d\d+)?)?\}/g
for (const b of bossData.bosses) {
  const where = `bosses.json "${b.id}"`
  if (bossIds.has(b.id)) fail(`${where}: id used twice`)
  bossIds.add(b.id)
  if (!bossData.scaling.floors.some((f) => f.floor === b.floor)) fail(`${where}: unknown floor ${b.floor}`)
  if (!b.attacks?.length) fail(`${where}: needs at least one attack`)
  for (const a of b.attacks ?? []) {
    if (!(a.percent > 0) || !(a.count >= 1)) fail(`${where}: attack "${a.name}" needs a percent and count`)
    if (!/^d(6|8|10|12)$/.test(a.die ?? '')) fail(`${where}: attack "${a.name}" needs a die (d6, d8, d10 or d12; bible: Damage dice)`)
  }
  if (!b.shiftAction?.name || !b.shiftAction.text) fail(`${where}: needs a Shift Action`)
  const RANKS = ['primary', 'strong', 'average', 'weak']
  const profiles = [['', b], ...Object.entries(b.partProfiles ?? {})] as const
  for (const [part, prof] of profiles) {
    const label = part ? `${where} part "${part}"` : where
    if (!sameKeys(prof.abilityRanks) || !Object.values(prof.abilityRanks).every((r) => RANKS.includes(r))) {
      fail(`${label}: abilityRanks needs str, dex, con, int, wis and cha, each primary, strong, average or weak`)
    }
    if (!prof.proficientSaves.every((s) => ABILITY_KEYS.includes(s))) fail(`${label}: unknown ability in proficientSaves`)
    if (part && !(b.parts ?? []).some((p) => p.name === part)) fail(`${label}: no part with that name`)
  }
  const floorSaves = bossData.scaling.floors.find((f) => f.floor === b.floor)?.proficientSaves
  if (b.proficientSaves.length !== floorSaves) fail(`${where}: floor ${b.floor} bosses are proficient in ${floorSaves} saves, not ${b.proficientSaves.length}`)
  const texts = [...(b.specials ?? []), ...(b.legendaryOptions ?? []), ...b.attacks, b.shiftAction].map((t) => ('text' in t ? t.text : ''))
  for (const text of texts) {
    for (const m of text.matchAll(PLACEHOLDER)) {
      if (!['dmg', 'hp', 'bpb', 'dc'].includes(m[1])) fail(`${where}: unknown placeholder "${m[0]}"`)
    }
  }
}
for (let floor = 1; floor <= 5; floor++) {
  const count = bossData.bosses.filter((b) => b.floor === floor).length
  if (count < 1) fail(`bosses.json: no boss for floor ${floor}`)
}
// Loot (Phase 6).
const lootRolls = loadObject<{
  rarities: { id: string }[]
  floorRoll: { floor: number; table: { upTo: number; kind: string }[] }[]
  amounts: { floor: number; rarity: Record<string, { base: string; onSix?: string }> }[]
}>('loot-rolls.json')
const lootItems = loadObject<{
  trinkets: string[]
  consumables: { id: string; name: string; effect: string }[]
  gear: { id: string; name: string; property: string }[]
  wondrous: Record<string, { id: string; name: string; effect: string }[]>
  trophies: { bossId: string; id: string; name: string; rarity: string; effect: string }[]
}>('loot-items.json')
const relicData = loadObject<{ relics: { id: string; name: string; tags: string[]; dormant: string; woken: string }[] }>('relics.json')
const rarityIds = lootRolls.rarities.map((r) => r.id)
const LOOT_KINDS = ['credits', 'trinket', 'consumable', 'gear', 'wondrous', 'basalts']
for (let floor = 1; floor <= 4; floor++) {
  const row = lootRolls.floorRoll.find((r) => r.floor === floor)
  if (!row) fail(`loot-rolls.json: no floor roll for floor ${floor}`)
  else {
    if (row.table[row.table.length - 1]?.upTo !== 100) fail(`loot-rolls.json floor ${floor}: the d100 table must end at 100`)
    for (const r of row.table) if (!LOOT_KINDS.includes(r.kind)) fail(`loot-rolls.json floor ${floor}: unknown kind "${r.kind}"`)
  }
  const amounts = lootRolls.amounts.find((a) => a.floor === floor)
  if (!amounts) fail(`loot-rolls.json: no amounts for floor ${floor}`)
  for (const tier of ['1', '2', '3']) {
    const r = amounts?.rarity[tier]
    if (!r || !rarityIds.includes(r.base) || (r.onSix && !rarityIds.includes(r.onSix))) {
      fail(`loot-rolls.json floor ${floor}: tier ${tier} needs known rarities`)
    }
  }
}
if (lootItems.trinkets.length !== 20) fail(`loot-items.json: expected 20 trinkets (d20), found ${lootItems.trinkets.length}`)
if (lootItems.consumables.length !== 12) fail(`loot-items.json: expected 12 consumables (d12)`)
if (lootItems.gear.length !== 12) fail(`loot-items.json: expected 12 gear items (d12)`)
for (const id of rarityIds) if (!lootItems.wondrous[id]?.length) fail(`loot-items.json: no wondrous items for ${id}`)
for (const b of bossData.bosses) {
  if (!lootItems.trophies.some((t) => t.bossId === b.id)) fail(`loot-items.json: no trophy for boss "${b.id}"`)
}
for (const t of lootItems.trophies) {
  if (!bossIds.has(t.bossId)) fail(`loot-items.json trophy "${t.id}": unknown boss "${t.bossId}"`)
  if (!rarityIds.includes(t.rarity)) fail(`loot-items.json trophy "${t.id}": unknown rarity "${t.rarity}"`)
}
const lootIds = new Set<string>()
for (const item of [...lootItems.consumables, ...lootItems.gear, ...Object.values(lootItems.wondrous).flat(), ...lootItems.trophies, ...relicData.relics]) {
  if (lootIds.has(item.id)) fail(`loot: id "${item.id}" is used twice`)
  lootIds.add(item.id)
}
for (const r of relicData.relics) {
  if (!r.dormant || !r.woken) fail(`relics.json "${r.id}": needs Dormant and Woken text`)
  for (const t of r.tags) if (!TAGS.includes(t)) fail(`relics.json "${r.id}": unknown tag "${t}"`)
}

// Lore check (bible: Content safety, Loot defaults). Every data file ships in
// the app, so campaign truths must stay out. Some words may appear only inside
// approved names players meet in play.
const lore = JSON.parse(readFileSync(new URL('./lore-allowlist.json', import.meta.url), 'utf8').replace(/^﻿/, '')) as {
  bannedEverywhere: string[]
  bannedExceptNames: string[]
  approvedNames: string[]
  approvedIds: string[]
}
const approved = [...lore.approvedNames, ...lore.approvedIds].sort((a, b) => b.length - a.length)
for (const file of readdirSync(new URL('../src/data/', import.meta.url)).filter((f) => f.endsWith('.json'))) {
  const text = readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8')
  for (const word of lore.bannedEverywhere) {
    if (text.toLowerCase().includes(word)) fail(`${file}: mentions "${word}", which must never ship in the app (Content safety)`)
  }
  let scrubbed = text
  for (const name of approved) scrubbed = scrubbed.split(name).join('')
  for (const word of lore.bannedExceptNames) {
    for (const line of scrubbed.split('\n')) {
      if (line.toLowerCase().includes(word)) {
        fail(`${file}: "${word}" appears outside an approved name (scripts/lore-allowlist.json): ${line.trim().slice(0, 120)}`)
      }
    }
  }
}

// firestore.rules carries a generated copy of upgrade prices and track caps.
const rulesText = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
if (withGeneratedBlock(rulesText) !== rulesText) {
  fail('firestore.rules is out of date with upgrades.json or stat-tracks.json. Run: npm run sync-rules')
}

if (errors.length) {
  console.error(`Found ${errors.length} problem(s) in the data files:\n`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(
  `Data OK: ${boons.length} boons, ${evolutions.length} evolutions, ${combinations.length} combinations, ${hiddenBoons.length} hidden boons, ${enemies.creatures.length} creatures, ${bossData.bosses.length} bosses, ${lootIds.size} loot items and relics.`,
)
