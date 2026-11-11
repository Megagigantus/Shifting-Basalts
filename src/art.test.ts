import { describe, expect, it } from 'vitest'
import bosses from './data/bosses.json'
import { partArtId, phase2ArtId } from './art'

describe('art ids', () => {
  it('turns boss part names into file names', () => {
    expect(partArtId('choir-hollow-column', 'Pipe cluster')).toBe('choir-hollow-column-pipe-cluster')
    expect(partArtId('kaelen-and-vyr', 'Vyr')).toBe('kaelen-and-vyr-vyr')
  })

  it('gives every boss part a distinct file name', () => {
    const ids = bosses.bosses.flatMap((b) => (b.parts ?? []).map((p) => partArtId(b.id, p.name)))
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'choir-hollow-column-pipe-cluster',
      'gilded-excavation-herd-golem',
      'gilded-excavation-herd-hound',
      'kaelen-and-vyr-kaelen',
      'kaelen-and-vyr-vyr',
      'chorus-unseen-angles-member',
    ])
  })

  it('names second-phase pictures after the boss', () => {
    expect(phase2ArtId('ophaniel')).toBe('ophaniel-phase-2')
  })
})
