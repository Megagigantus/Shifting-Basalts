// DM panel for one player's boons during a run: slots, levels, evolve,
// combine, suppress and the hidden boon. Each button runs a rule from
// rules/boons.ts through the tracker's save step.
import { useState } from 'react'
import type { Character } from '../model/character'
import type { RunPlayer, RunState } from '../model/run'
import {
  availableCombinations,
  boon,
  BOONS,
  clearSlot,
  combine,
  evolutionFor,
  evolve,
  fitSlots,
  HIDDEN_BOONS,
  hiddenBoon,
  levelUp,
  MAX_LEVEL,
  replaceBoon,
  setSuppressed,
  slotCount,
  slotName,
  slotRulesText,
  slotTags,
  takeBoon,
  type Slot,
} from '../rules/boons'
import { changeSlots, setHiddenBoon } from '../rules/runFlow'
import { rankProgress } from '../rules/statTracks'

type Step = (s: RunState) => RunState

interface Props {
  player: RunPlayer
  character: Character | undefined
  busy: boolean
  act: (step: Step, confirmText?: string) => void
}

const TAG_ORDER = [...new Set(BOONS.flatMap((b) => b.tags))]

/** Reasons a boon may not suit this character. Shown as warnings, not enforced. */
function fitWarnings(boonId: string, character: Character | undefined): string[] {
  if (!character) return []
  const b = boon(boonId)
  const warnings: string[] = []
  if (b.tags.includes('Spell') && character.casterType === 'none') warnings.push('Spell boon, but this character has no spells.')
  if (b.tags.includes('Bond') && !character.hasSummon) warnings.push('Bond boon, but this character has no summon or companion.')
  if (b.payoffTrack && rankProgress(character.trackDevotions[b.payoffTrack] ?? 0).rank < 1) {
    warnings.push('Payoff boon, but this character has no rank in its stat track yet.')
  }
  return warnings
}

export function PlayerBoons({ player, character, busy, act }: Props) {
  const [picked, setPicked] = useState('')
  const [hiddenPick, setHiddenPick] = useState('')
  const id = player.characterId
  const slots = fitSlots(player.slots, slotCount(character?.upgrades['extra-boon-slot'] ?? 0))
  const combos = availableCombinations(slots)
  const pickedIsHeld = slots.some((s) => s?.kind === 'boon' && s.boonId === picked)
  const hasEmpty = slots.some((s) => s === null)
  const hiddenChoices = HIDDEN_BOONS.filter((h) => h.kind === 'gift' || h.classId === character?.classId)

  // Every change goes through the player's full slot list, sized for their upgrades.
  const onSlots = (change: (s: Slot[]) => Slot[], confirmText?: string) =>
    act((state) => changeSlots(state, id, () => change(slots)), confirmText)

  return (
    <div className="player-boons">
      <ol className="slot-list">
        {slots.map((slot, i) => (
          <li key={i} className={`slot ${slot?.suppressed ? 'suppressed' : ''}`}>
            {!slot ? (
              <span className="hint">Empty slot</span>
            ) : (
              <>
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
                <div className="row-actions wrap">
                  {slot.kind === 'boon' && slot.level < MAX_LEVEL && (
                    <button type="button" disabled={busy} onClick={() => onSlots((s) => levelUp(s, i))}>
                      Level up
                    </button>
                  )}
                  {evolutionFor(slot) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onSlots((s) => evolve(s, i), `Evolve into ${evolutionFor(slot)!.name}? This can't be undone except by removing it.`)
                      }
                    >
                      Evolve into {evolutionFor(slot)!.name}
                    </button>
                  )}
                  <button type="button" disabled={busy} onClick={() => onSlots((s) => setSuppressed(s, i, !slot.suppressed))}>
                    {slot.suppressed ? 'Unsuppress' : 'Suppress'}
                  </button>
                  {picked && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onSlots((s) => replaceBoon(s, i, picked), `Replace ${slotName(slot)} with ${boon(picked).name} at Level 1?`)
                      }
                    >
                      Replace with {boon(picked).name}
                    </button>
                  )}
                  <button
                    type="button"
                    className="quiet"
                    disabled={busy}
                    onClick={() => onSlots((s) => clearSlot(s, i), `Remove ${slotName(slot)}? Use this to correct mistakes.`)}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>

      {combos.length > 0 && (
        <div className="row-actions wrap">
          {combos.map(({ combination: c }) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() =>
                onSlots(
                  (s) => combine(s, c.id),
                  `Combine ${c.boons.map((b) => boon(b).name).join(' + ')} into ${c.name}? Combinations are final and free up a slot.`,
                )
              }
            >
              Combine into {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="boon-picker">
        <select value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Pick a boon">
          <option value="">Pick a boon…</option>
          {TAG_ORDER.map((tag) => (
            <optgroup key={tag} label={tag}>
              {BOONS.filter((b) => b.tags[0] === tag).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !picked || (!pickedIsHeld && !hasEmpty)}
          onClick={() => {
            onSlots((s) => takeBoon(s, picked))
            setPicked('')
          }}
        >
          {pickedIsHeld ? 'Take (levels it up)' : 'Take'}
        </button>
      </div>
      {picked && (
        <div className="hint">
          {boon(picked).levels[0]}
          {fitWarnings(picked, character).map((w) => (
            <div key={w} className="warning">
              {w}
            </div>
          ))}
          {!pickedIsHeld && !hasEmpty && <div className="warning">No empty slot: use Replace on a slot above.</div>}
        </div>
      )}

      <div className="hidden-slot">
        <span>
          Hidden boon:{' '}
          {player.hiddenBoonId ? (
            <>
              <strong>{hiddenBoon(player.hiddenBoonId).name}</strong>
              <span className="hint"> {hiddenBoon(player.hiddenBoonId).effect}</span>
            </>
          ) : (
            <span className="hint">none</span>
          )}
        </span>
        <div className="boon-picker">
          <select value={hiddenPick} onChange={(e) => setHiddenPick(e.target.value)} aria-label="Pick a hidden boon">
            <option value="">Pick a hidden boon…</option>
            <optgroup label="Class hidden boon">
              {hiddenChoices
                .filter((h) => h.kind === 'class')
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.condition})
                  </option>
                ))}
            </optgroup>
            <optgroup label="Thils's hidden gifts">
              {hiddenChoices
                .filter((h) => h.kind === 'gift')
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </optgroup>
          </select>
          <button
            type="button"
            disabled={busy || !hiddenPick}
            onClick={() => {
              act(
                (s) => setHiddenBoon(s, id, hiddenPick),
                player.hiddenBoonId ? `Replace ${hiddenBoon(player.hiddenBoonId).name} with ${hiddenBoon(hiddenPick).name}?` : undefined,
              )
              setHiddenPick('')
            }}
          >
            {player.hiddenBoonId ? 'Replace hidden boon' : 'Set hidden boon'}
          </button>
          {player.hiddenBoonId && (
            <button type="button" className="quiet" disabled={busy} onClick={() => act((s) => setHiddenBoon(s, id, null))}>
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
