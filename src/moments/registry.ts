// One list of moment modules: type -> module. To add a moment type, write
// one module and add one entry below; nothing else changes.
import { defineMoment, type MomentModule } from './moduleTypes'
import { boonRevealModule } from './boonReveal'

export { defineMoment }
export type { MomentModule, MomentPlayerProps, MomentSample, SampleContext } from './moduleTypes'

// Add one entry per moment type.
const MODULES: MomentModule[] = [boonRevealModule]

const BY_TYPE = new Map<string, MomentModule>()
for (const mod of MODULES) {
  if (BY_TYPE.has(mod.type)) {
    throw new Error(`Duplicate moment module type "${mod.type}"`)
  }
  BY_TYPE.set(mod.type, mod)
}

/** Look up a registered moment module by its type key. */
export function momentModule(type: string): MomentModule | null {
  return BY_TYPE.get(type) ?? null
}

/** Return all registered moment modules. */
export function momentModules(): MomentModule[] {
  return [...MODULES]
}
