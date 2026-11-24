// The Forge in the post-boss room: what each player can do with a use.
import type { ReactNode } from 'react'
import type { RunPlayer } from '../model/run'
import { boon, combination, evolutionFor, slotName } from '../rules/boons'
import { forgeOptions, type ForgeAction } from '../rules/forge'
import { SMALL_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'

function label(action: ForgeAction, player: RunPlayer): string {
  const slots = player.slots ?? []
  if (action.kind === 'combine') {
    const c = combination(action.combinationId)
    return `Fuse ${c.boons.map((id) => boon(id).name).join(' + ')} into ${c.name}`
  }
  const slot = slots[action.slotIndex]
  if (!slot) return 'Empty slot'
  if (action.kind === 'evolve') return `Evolve ${slotName(slot)} into ${evolutionFor(slot)?.name}`
  return `Level up ${slotName(slot)} to Level ${slot.kind === 'boon' ? slot.level + 1 : ''}`
}

interface Props {
  players: RunPlayer[]
  usesLeft: number
  busy: boolean
  onUse: (characterId: string, action: ForgeAction) => void
  /** Shown above the options. */
  note?: ReactNode
}

export function ForgeOptions({ players, usesLeft, busy, onUse, note }: Props) {
  if (usesLeft < 1) return null
  return (
    <div className="flex flex-col gap-2">
      {note && <p className="m-0 text-[0.6875rem] text-stone-400">{note}</p>}
      {players
        .filter((p) => p.alive)
        .map((p) => {
          const options = forgeOptions(p.slots ?? [])
          return (
            <div key={p.characterId} className={cx(WELL, 'flex flex-col gap-1.5')}>
              <strong className="text-xs text-stone-100">{p.name}</strong>
              {options.length === 0 ? (
                <span className="text-[0.6875rem] text-stone-500">Nothing to forge yet.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={busy}
                      onClick={() => onUse(p.characterId, o)}
                      className={cx(SMALL_BUTTON, o.kind === 'evolve' ? 'text-violet-200' : o.kind === 'combine' ? 'text-emerald-200' : 'text-amber-200')}
                    >
                      {label(o, p)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}
