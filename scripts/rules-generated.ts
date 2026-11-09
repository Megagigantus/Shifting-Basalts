// Builds the section of firestore.rules that mirrors game data (upgrade
// prices, stat track ids and Devotion caps), so the database can re-check
// player spends. Firestore rules can't read our JSON files, so this copies the
// numbers in. Run `npm run sync-rules` after editing upgrades.json or
// stat-tracks.json; `npm run check-data` fails if the rules are out of date.
import { readFileSync } from 'node:fs'

export const BEGIN = '    // BEGIN GENERATED (npm run sync-rules). Do not edit by hand.'
export const END = '    // END GENERATED'

const readJson = (file: string) =>
  JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8').replace(/^﻿/, ''))

export function generatedBlock(): string {
  const upgrades: { id: string; costs: number[] }[] = readJson('upgrades.json').upgrades
  const tracks: { id: string }[] = readJson('stat-tracks.json').tracks
  const costBands: { fromRank: number; toRank: number; devotions: number }[] = readJson('stat-tracks.json').rankCosts
  const tiers: { minLevel: number; maxLevel: number; maxRank: number }[] = readJson('stat-tracks.json').tierCaps

  // Devotions needed to reach a rank, the same way rules/statTracks.ts adds them up.
  const devotionsForRank = (rank: number) => {
    let total = 0
    for (let r = 1; r <= rank; r++) total += costBands.find((b) => r >= b.fromRank && r <= b.toRank)!.devotions
    return total
  }

  const sorted = [...tiers].sort((a, b) => a.minLevel - b.minLevel)
  let cap = '0'
  for (const tier of [...sorted].reverse()) {
    cap = `level <= ${tier.maxLevel} ? ${devotionsForRank(tier.maxRank)} : ${cap}`
  }
  cap = `level < ${sorted[0].minLevel} ? 0 : ${cap}`

  const prices = upgrades.map((u) => `'${u.id}': [${u.costs.join(', ')}]`).join(',\n        ')
  const trackIds = tracks.map((t) => `'${t.id}'`).join(', ')

  return [
    BEGIN,
    '    // Upgrade id -> price of each rank (from src/data/upgrades.json).',
    '    function upgradePrices() {',
    '      return {',
    `        ${prices}`,
    '      };',
    '    }',
    '',
    '    // Stat track ids (from src/data/stat-tracks.json).',
    '    function statTrackIds() {',
    `      return [${trackIds}];`,
    '    }',
    '',
    '    // Most Devotions one track may hold at a character level (tier caps).',
    '    function devotionCap(level) {',
    `      return ${cap};`,
    '    }',
    '',
    '    // True if this update is a valid Devotion spend on one of the tracks.',
    '    function anyTrackSpend() {',
    `      return ${tracks.map((t) => `devotionSpendOn('${t.id}')`).join('\n        || ')};`,
    '    }',
    '',
    '    // True if this update is a valid purchase of one of the upgrades.',
    '    function anyUpgradePurchase() {',
    `      return ${upgrades.map((u) => `upgradePurchaseOf('${u.id}')`).join('\n        || ')};`,
    '    }',
    END,
  ].join('\n')
}

/** Replace the generated section inside the rules text. */
export function withGeneratedBlock(rules: string): string {
  const start = rules.indexOf(BEGIN)
  const end = rules.indexOf(END)
  if (start < 0 || end < 0) throw new Error('firestore.rules is missing the generated section markers.')
  return rules.slice(0, start) + generatedBlock() + rules.slice(end + END.length)
}
