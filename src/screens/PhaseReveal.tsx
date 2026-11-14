// Players: a one-time full-screen look at a boss's phase 2 portrait and the
// name of its new phase, the first time the boss is Bloodied. Closes with a
// tap or after a few seconds. The browser remembers it was seen, per run and
// boss (if storage is blocked, it just shows again next time).
import { useEffect, useState } from 'react'
import { bossOf } from '../rules/bosses'
import { artUrl, phase2ArtId } from '../art'

const seenKey = (runId: string, bossId: string) => `phase-reveal:${runId}:${bossId}`

function wasSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Storage blocked: the reveal may show again, which is harmless.
  }
}

/** The phase 2 name from the boss's specials, e.g. "The Gate Opens". */
function phaseName(bossId: string): string | null {
  const special = (bossOf(bossId).specials ?? []).find((s) => /phase 2/i.test(s.name))
  return special ? special.name.replace(/\s*\(.*\)\s*$/, '') : null
}

export function PhaseReveal({ runId, bossId, bloodied }: { runId: string; bossId: string; bloodied: boolean }) {
  const key = seenKey(runId, bossId)
  const art = artUrl('bosses', phase2ArtId(bossId))
  const [closed, setClosed] = useState(() => wasSeen(key))
  const open = bloodied && Boolean(art) && !closed

  useEffect(() => {
    if (!open) return
    markSeen(key)
    const timer = setTimeout(() => setClosed(true), 7000)
    return () => clearTimeout(timer)
  }, [open, key])

  if (!open) return null
  const name = phaseName(bossId)
  return (
    <div className="phase-reveal" role="dialog" aria-label={`${bossOf(bossId).name}: phase 2`} onClick={() => setClosed(true)}>
      <figure>
        <img src={art!} alt={`${bossOf(bossId).name}, phase 2`} />
        <figcaption>
          <strong>{bossOf(bossId).name}</strong>
          {name && <span>{name}</span>}
          <span className="hint">Tap to close</span>
        </figcaption>
      </figure>
    </div>
  )
}
