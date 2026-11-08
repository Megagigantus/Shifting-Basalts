// Read-only view of one player's boons, for the player screens.
import type { RunPlayer } from '../model/run'
import { hiddenBoon, slotName, slotRulesText, slotTags, type SlotContent } from '../rules/boons'

export function BoonList({ player }: { player: RunPlayer }) {
  const held = (player.slots ?? []).filter((s): s is SlotContent => s !== null)
  const total = player.slots?.length ?? 0
  const hidden = player.hiddenBoonId ? hiddenBoon(player.hiddenBoonId) : null

  return (
    <div className="player-boons">
      <span className="hint">
        {held.length} of {total} boon slots filled
      </span>
      {held.length > 0 && (
        <ol className="slot-list">
          {held.map((slot, i) => (
            <li key={i} className={`slot ${slot.suppressed ? 'suppressed' : ''}`}>
              <div className="slot-title">
                <strong>{slotName(slot)}</strong>
                {slot.kind === 'boon' && <span className="tag">Level {slot.level}</span>}
                {slot.kind === 'evolution' && <span className="tag">Evolution</span>}
                {slot.kind === 'combination' && <span className="tag">Combination</span>}
                {slotTags(slot).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
                {slot.suppressed && <span className="warning">Suppressed</span>}
              </div>
              <details>
                <summary className="hint">Rules text</summary>
                {slotRulesText(slot).map((line) => (
                  <p key={line} className="hint">
                    {line}
                  </p>
                ))}
              </details>
            </li>
          ))}
        </ol>
      )}
      {hidden && (
        <div className="hidden-slot">
          <span>
            Hidden boon: <strong>{hidden.name}</strong>
          </span>
          <span className="hint">{hidden.effect}</span>
        </div>
      )}
    </div>
  )
}
