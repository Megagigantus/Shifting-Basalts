// Checks the game-content files in src/data for mistakes.
// Run with: npm run check-data
// Exits with an error if anything is wrong, so it can also guard builds.
import { readFileSync } from 'node:fs'
import type { Boon, Combination, Evolution } from '../src/data/types.ts'

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

const errors: string[] = []
const fail = (msg: string) => errors.push(msg)

// Ids must be unique across all three files, since they share one namespace.
const seen = new Map<string, string>()
for (const [file, items] of [
  ['boons.json', boons],
  ['evolutions.json', evolutions],
  ['combinations.json', combinations],
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

if (errors.length) {
  console.error(`Found ${errors.length} problem(s) in the data files:\n`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(
  `Data OK: ${boons.length} boons, ${evolutions.length} evolutions, ${combinations.length} combinations.`,
)
