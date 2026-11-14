// A pop-up window over the page, e.g. the invite list. Esc, the X button or a
// click outside closes it.
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cx } from './tone'

interface Props {
  title: ReactNode
  onClose: () => void
  /** Wider window for big content. */
  wide?: boolean
  children: ReactNode
}

export function Modal({ title, onClose, wide, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:pt-16"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'box-border w-full rounded-2xl border border-stone-700 bg-stone-900 text-stone-100 shadow-2xl',
          wide ? 'max-w-4xl' : 'max-w-xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-stone-800 px-4 py-3">
          <h2 className="m-0 text-sm font-bold text-amber-300">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full border border-stone-700 bg-stone-950 p-1.5 text-stone-200 hover:bg-stone-800 cursor-pointer"
          >
            <X size={14} />
          </button>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
