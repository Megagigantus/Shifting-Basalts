import { defineMoment } from '../moduleTypes'
import { BoonRevealPlayer } from './BoonRevealPlayer'
import {
  type BoonRevealPayload,
  describeReveal,
  revealAssets,
  revealEstimateMs,
  tableAssets,
  sampleRevealAllTiers,
  sampleRevealThils,
} from './payload'

/** Synchronized cinematic reveal module for drafted, forge, and hidden boons. */
export const boonRevealModule = defineMoment<BoonRevealPayload>({
  type: 'boonReveal',
  label: 'Boon reveal',
  Player: BoonRevealPlayer,
  estimateMs: (m) => revealEstimateMs(m.payload),
  describe: (m, names) => describeReveal(m.payload, names),
  preload: (m, viewer) =>
    viewer.kind === 'player'
      ? revealAssets(m.payload, viewer.characterIds)
      : viewer.kind === 'table'
        ? tableAssets(m.payload)
        : { sounds: [], images: [] },
  samples: [
    { label: 'Boon reveal: every tier', build: sampleRevealAllTiers },
    { label: 'Boon reveal: Thils accent', build: sampleRevealThils },
  ],
})
