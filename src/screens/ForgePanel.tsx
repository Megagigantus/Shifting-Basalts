// The Forge in the post-boss room: what each player can do with a use.
import type { RunPlayer } from '../model/run'
import { boon, combination, evolutionFor, slotName } from '../rules/boons'
import { forgeOptions, type ForgeAction } from '../rules/forge'

function label(action: ForgeAction, player: RunPlayer): string {
  const slots = player.slots ?? []
  if (action.kind === 'combine') {
    const c = combination(action.combinationId)
    return `Combine ${c.boons.map((id) => boon(id).name).join(' + ')} into ${c.name}`
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
  /** Shown above the options, e.g. "Use the party's Forge". */
  intro?: string
}

export function ForgePanel({ players, usesLeft, busy, onUse, intro }: Props) {
  if (usesLeft < 1) return null
  return (
    <div className="forge">
      <h3>
        The Forge: {usesLeft} use{usesLeft === 1 ? '' : 's'} left
      </h3>
      <p className="hint">
        {intro ?? 'Each use levels up a boon, or evolves or combines Level 3 boons.'} It cools when the party descends.
      </p>
      {players
        .filter((p) => p.alive)
        .map((p) => {
          const options = forgeOptions(p.slots ?? [])
          return (
            <div key={p.characterId} className="forge-player">
              <strong>{p.name}</strong>
              {options.length === 0 ? (
                <span className="hint"> nothing to forge yet</span>
              ) : (
                <div className="row-actions wrap">
                  {options.map((o, i) => (
                    <button key={i} type="button" disabled={busy} onClick={() => onUse(p.characterId, o)}>
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
