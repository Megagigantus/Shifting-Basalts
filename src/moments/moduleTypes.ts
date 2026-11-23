// The shape every moment module follows. Kept apart from registry.ts so a
// module can import defineMoment without a circular import.
import type { ComponentType } from 'react'
import type { Moment, MomentViewer, NewMoment } from './types'

/** Props passed to each moment module's full-screen Player component. */
export interface MomentPlayerProps<P> {
  moment: Moment<P>
  viewer: MomentViewer
  skipped: boolean
  reducedMotion: boolean
  onDone: () => void
}

/** Character roster context provided to DM test sample builders. */
export interface SampleContext {
  characterIds: string[]
  names: Record<string, string>
}

/** Sample moment factory exposed by a module for DM testing. */
export interface MomentSample<P> {
  label: string
  build: (ctx: SampleContext) => NewMoment<P>
}

/** Self-contained definition of one synchronized cinematic moment type. */
export interface MomentModule<P = Record<string, unknown>> {
  type: string
  label: string
  Player: ComponentType<MomentPlayerProps<P>>
  estimateMs: (moment: Moment<P>) => number
  describe: (moment: Moment<P>, names: Record<string, string>) => string
  preload?: (moment: Moment<P>, viewer: MomentViewer) => { sounds: string[]; images: string[] }
  samples: MomentSample<P>[]
}

/** Register a strongly-typed moment module in the untyped registry without `any`. */
export function defineMoment<P>(module: MomentModule<P>): MomentModule {
  return module as unknown as MomentModule
}
