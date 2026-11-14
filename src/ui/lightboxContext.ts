// The shared art viewer's hook. The viewer itself is LightboxProvider in
// Lightbox.tsx, mounted once in main.tsx.
import { createContext, useContext } from 'react'

export interface LightboxArt {
  src: string
  title: string
  subtitle?: string
  description?: string
  /** A second picture with its toggle label, e.g. { label: 'Phase 2', src }. */
  alternate?: { label: string; src: string }
  /** Label for the first picture when there is an alternate (default "Main"). */
  primaryLabel?: string
}

export const LightboxContext = createContext<(art: LightboxArt) => void>(() => {})

/** Open a picture in the shared viewer: `const showArt = useLightbox(); showArt({ src, title })`. */
export function useLightbox() {
  return useContext(LightboxContext)
}
