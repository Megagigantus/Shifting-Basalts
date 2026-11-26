// Maps boss and enemy-family lore art URLs to their floor for maze glow scaling.
import { artUrl, phase2ArtId } from '../art'
import bossesData from '../data/bosses.json'
import enemiesData from '../data/enemies.json'

/** Heaviest floor in a family's floorWeights map, breaking ties toward the deepest floor. */
export function familyGlowFloor(
  floorWeights: Record<string, number | undefined>,
): number | null {
  let bestFloor: number | null = null
  let bestWeight = -Infinity

  for (const [key, weight] of Object.entries(floorWeights)) {
    const floor = Number(key)
    if (!Number.isFinite(floor) || weight === undefined || !Number.isFinite(weight)) continue
    if (weight > bestWeight || (weight === bestWeight && (bestFloor === null || floor > bestFloor))) {
      bestWeight = weight
      bestFloor = floor
    }
  }

  return bestFloor
}

const floorByArtUrl = new Map<string, number>()

for (const boss of bossesData.bosses) {
  for (const id of [boss.id, phase2ArtId(boss.id)]) {
    const url = artUrl('bosses', id)
    if (url) {
      floorByArtUrl.set(url, boss.floor)
    }
  }
}

for (const family of enemiesData.families) {
  const floor = familyGlowFloor(family.floorWeights)
  if (floor === null) continue
  const url = artUrl('families', family.id)
  if (url) {
    floorByArtUrl.set(url, floor)
  }
}

/** Look up the floor associated with a boss or enemy-family art URL, or null when unmatched. */
export function loreMazeFloorForArt(src: string): number | null {
  return floorByArtUrl.get(src) ?? null
}
