import { useId } from 'react'

export interface EyeRefs {
  lidTop: SVGSVGElement | null
  lidBottom: SVGSVGElement | null
  slit: HTMLDivElement | null
  iris: HTMLDivElement | null
}

/** Closed stone eyelids, glowing slit, and expanding iris ring overlaid on a hidden boon card. */
export function EyeLids({
  color,
  setRef,
}: {
  color: string
  setRef: (key: keyof EyeRefs, el: Element | null) => void
}) {
  const uid = useId()
  const topGradId = `${uid}-lid-top`
  const bottomGradId = `${uid}-lid-bottom`

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
    >
      <svg
        ref={(el) => setRef('lidTop', el)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={topGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#0c0a09" />
          </linearGradient>
        </defs>
        <path d="M0,0 H100 V62 Q50,38 0,62 Z" fill={`url(#${topGradId})`} />
        <path
          d="M0,62 Q50,38 100,62"
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <svg
        ref={(el) => setRef('lidBottom', el)}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={bottomGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1917" />
            <stop offset="100%" stopColor="#0c0a09" />
          </linearGradient>
        </defs>
        <path d="M0,100 H100 V38 Q50,62 0,38 Z" fill={`url(#${bottomGradId})`} />
        <path
          d="M0,38 Q50,62 100,38"
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={(el) => setRef('slit', el)}
          style={{
            background: `radial-gradient(ellipse at center, ${color} 0%, transparent 72%)`,
            boxShadow: `0 0 18px 2px ${color}`,
          }}
          className="h-[10%] w-[80%] rounded-[50%]"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          ref={(el) => setRef('iris', el)}
          style={{
            border: `2px solid ${color}`,
            boxShadow: `0 0 16px ${color}`,
          }}
          className="aspect-square w-[45%] rounded-full"
        />
      </div>
    </div>
  )
}
