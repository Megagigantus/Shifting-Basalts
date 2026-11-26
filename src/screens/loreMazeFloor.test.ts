// Unit tests for floor-based lore maze lookups and theme style scaling.
import { describe, expect, it } from 'vitest'
import enemiesData from '../data/enemies.json'
import { loreMazeStyle } from '../moments/theme'
import { familyGlowFloor, loreMazeFloorForArt } from './loreMazeFloor'

describe('familyGlowFloor', () => {
  it('returns the expected heaviest/deepest floor for each family in enemies.json', () => {
    const floors = Object.fromEntries(
      enemiesData.families.map((family) => [family.id, familyGlowFloor(family.floorWeights)]),
    )

    expect(floors).toEqual({
      wardstones: 3,
      mazework: 4,
      'the-lost': 4,
      'absorbed-echoes': 3,
      'gate-born': 4,
      'inverted-paradise': 4,
    })
  })

  it('returns null for an empty floorWeights map', () => {
    expect(familyGlowFloor({})).toBeNull()
  })
})

describe('loreMazeStyle', () => {
  it('defaults missing or unknown floors to floor 3', () => {
    const floor3 = loreMazeStyle(3)
    expect(loreMazeStyle(null)).toEqual(floor3)
    expect(loreMazeStyle(undefined)).toEqual(floor3)
    expect(loreMazeStyle(99)).toEqual(floor3)
  })

  it('increases opacity and never decreases density or glow from floor 1 to 5', () => {
    expect(loreMazeStyle(5).restOpacity).toBeGreaterThan(loreMazeStyle(1).restOpacity)

    for (let floor = 2; floor <= 5; floor++) {
      const prev = loreMazeStyle(floor - 1)
      const curr = loreMazeStyle(floor)
      expect(curr.restOpacity).toBeGreaterThanOrEqual(prev.restOpacity)
      expect(curr.rootsMax).toBeGreaterThanOrEqual(prev.rootsMax)
      expect(curr.glowScale).toBeGreaterThanOrEqual(prev.glowScale)
    }
  })
})

describe('loreMazeFloorForArt', () => {
  it('returns null for unmatched art URLs', () => {
    expect(loreMazeFloorForArt('/art/unknown/card.webp')).toBeNull()
  })
})
