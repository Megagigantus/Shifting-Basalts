// One shared viewer for enlarged art. Any screen calls
//   const showArt = useLightbox()
//   showArt({ src, title, ... })
// and the picture opens over the page. Esc, the X button or a click outside
// the picture closes it. A boss can pass a second picture (e.g. its part art
// or phase 2) and the viewer shows a toggle between the two.
//
// Callers decide visibility: only pass pictures and text the viewer may see.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { LightboxContext, type LightboxArt } from './lightboxContext'
import { cx } from './tone'

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [art, setArt] = useState<LightboxArt | null>(null)
  const open = useCallback((next: LightboxArt) => setArt(next), [])
  return (
    <LightboxContext.Provider value={open}>
      {children}
      {art && <LightboxView art={art} onClose={() => setArt(null)} />}
    </LightboxContext.Provider>
  )
}

function LightboxView({ art, onClose }: { art: LightboxArt; onClose: () => void }) {
  const [showAlternate, setShowAlternate] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const src = showAlternate && art.alternate ? art.alternate.src : art.src
  const toggleButton = 'rounded-md px-2.5 py-1 text-xs font-semibold border cursor-pointer'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={art.title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-700 bg-stone-900 text-stone-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 rounded-full border border-stone-700 bg-stone-950/80 p-1.5 text-stone-200 hover:bg-stone-800 cursor-pointer"
        >
          <X size={16} />
        </button>
        <img src={src} alt={art.title} className="max-h-[70vh] w-full bg-stone-950 object-contain" />
        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="m-0 text-base font-bold text-amber-300">{art.title}</h2>
              {art.subtitle && <p className="m-0 text-xs text-stone-400">{art.subtitle}</p>}
            </div>
            {art.alternate && (
              <div className="flex gap-1.5" role="group" aria-label="Which picture">
                <button
                  type="button"
                  aria-pressed={!showAlternate}
                  onClick={() => setShowAlternate(false)}
                  className={cx(toggleButton, !showAlternate ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-stone-700 bg-stone-800 text-stone-300')}
                >
                  {art.primaryLabel ?? 'Main'}
                </button>
                <button
                  type="button"
                  aria-pressed={showAlternate}
                  onClick={() => setShowAlternate(true)}
                  className={cx(toggleButton, showAlternate ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-stone-700 bg-stone-800 text-stone-300')}
                >
                  {art.alternate.label}
                </button>
              </div>
            )}
          </div>
          {art.description && <p className="m-0 text-sm text-stone-300">{art.description}</p>}
        </div>
      </div>
    </div>
  )
}
