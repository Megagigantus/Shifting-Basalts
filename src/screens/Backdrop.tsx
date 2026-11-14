// The faint dungeon picture behind every screen: the entrance outside a run,
// the interior during one. Purely decorative.
import { artUrl } from '../art'

export function Backdrop({ inRun }: { inRun: boolean }) {
  const url = artUrl('rooms', inRun ? 'basalts-int' : 'basalt-entrance')
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-stone-950">
      {url && <img src={url} alt="" className="h-full w-full object-cover opacity-35" />}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-stone-950/80 to-stone-950/95" />
    </div>
  )
}
