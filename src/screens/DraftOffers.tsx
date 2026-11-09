// One player's draft offer and hidden offer, as cards. Used by the DM (who
// applies choices directly) and by players (whose choices are sent to the
// DM's app). The screen itself never changes the run; it calls onChoose.
import { useState } from 'react'
import type { RunPlayer } from '../model/run'
import type { DraftChoice } from '../rules/draftChoice'
import { hiddenBoon, slotName, type Slot } from '../rules/boons'
import { describeHidden, describeOffer } from '../offerText'

interface Props {
  player: RunPlayer
  /** Quantum Basalts a pass is worth in this run. */
  passValue: number
  rerollsLeft: number
  busy: boolean
  onChoose: (choice: DraftChoice) => void
  /** "You" for the player's own screen, or the player's name for the DM. */
  who?: string
}

export function DraftOffers({ player, passValue, rerollsLeft, busy, onChoose, who }: Props) {
  const slots: Slot[] = player.slots ?? []
  const hasEmpty = slots.some((s) => s === null)
  const [replaceSlot, setReplaceSlot] = useState<Record<number, number>>({})
  const draft = player.draft
  const hidden = player.hiddenOffer

  if (!draft && !hidden) return null

  return (
    <div className="draft">
      {draft && (
        <>
          <div className="panel-header">
            <h3>
              {draft.starting
                ? who ? `${who}: Starting Boon` : 'Your Starting Boon'
                : who ? `${who}: choose a boon` : 'Choose a boon'}
            </h3>
            <span className="hint">
              {draft.starting
                ? 'Before room 1'
                : `Floor ${draft.floor}, ${draft.elite ? 'elite room' : `room ${draft.room}`}`}
            </span>
          </div>
          <div className="offer-cards">
            {draft.offers.map((offer, i) => {
              const text = describeOffer(offer, slots)
              const needsReplace = text.needsSlot && !hasEmpty
              const target = replaceSlot[i] ?? 0
              return (
                <div key={i} className="offer-card">
                  <span className="hint">{text.label}</span>
                  <strong>{text.heading}</strong>
                  {text.tag && <span className="tag">{text.tag}</span>}
                  <p className="hint">{text.text}</p>
                  {needsReplace ? (
                    <div className="replace-row">
                      <select
                        value={target}
                        onChange={(e) => setReplaceSlot({ ...replaceSlot, [i]: Number(e.target.value) })}
                        aria-label="Slot to replace"
                      >
                        {slots.map((s, si) => (
                          <option key={si} value={si}>
                            Replace {s ? slotName(s) : 'empty slot'}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onChoose({ action: 'take', index: i, replaceSlot: target })}
                      >
                        Take
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => onChoose({ action: 'take', index: i })}>
                      Take
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div className="row-actions wrap">
            <button type="button" disabled={busy} onClick={() => onChoose({ action: 'pass' })}>
              Pass (+{passValue} Quantum Basalt{passValue === 1 ? '' : 's'})
            </button>
            {rerollsLeft > 0 && (
              <button type="button" disabled={busy} onClick={() => onChoose({ action: 'reroll' })}>
                Reroll offer ({rerollsLeft} left this floor)
              </button>
            )}
          </div>
        </>
      )}

      {hidden && (
        <div className="hidden-offer">
          <h3>{who ? `${who}: hidden offer` : 'Hidden offer'}</h3>
          <p className="hint">
            Thils approves. Take one for your hidden slot
            {player.hiddenBoonId ? ` (replaces ${hiddenBoon(player.hiddenBoonId).name})` : ''}, or pass.
          </p>
          <div className="offer-cards">
            {[...(hidden.classBoon ? [hidden.classBoon] : []), ...hidden.gifts].map((id) => {
              const text = describeHidden(id)
              return (
                <div key={id} className="offer-card hidden-card">
                  <span className="hint">{id === hidden.classBoon ? 'Class hidden boon' : "Thils's gift"}</span>
                  <strong>{text.heading}</strong>
                  <p className="hint">{text.text}</p>
                  <button type="button" disabled={busy} onClick={() => onChoose({ action: 'hidden', hiddenBoonId: id })}>
                    Take
                  </button>
                </div>
              )
            })}
          </div>
          <button type="button" disabled={busy} onClick={() => onChoose({ action: 'passHidden' })}>
            Pass (+{passValue} Quantum Basalt{passValue === 1 ? '' : 's'})
          </button>
        </div>
      )}
    </div>
  )
}
