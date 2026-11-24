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
  takeBoon,
  type Slot,
} from '../rules/boons'
import { changeSlots, setHiddenBoon } from '../rules/runFlow'
import { rankProgress } from '../rules/statTracks'
import { HiddenSlot, SlotCard } from './BoonList'
import { ConfirmButton } from '../ui/ConfirmButton'
import { FIELD, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

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
  if (b.payoffTrack && rankProgress(character.trackDevotions[b.payoffTrack] ?? 0).rank < (b.payoffMinRank ?? 1)) {
    warnings.push(`Payoff boon, but this character needs rank ${b.payoffMinRank ?? 1} in its stat track.`)
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
    <div className="flex flex-col gap-3">
      <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
        {slots.map((slot, i) =>
          !slot ? (
            <li key={i} className="rounded-lg border border-dashed border-stone-700 px-2.5 py-2 text-[0.6875rem] text-stone-500">
              Empty slot
            </li>
          ) : (
            <SlotCard key={i} slot={slot}>
              {slot.kind === 'boon' && slot.level < MAX_LEVEL && (
                <button type="button" className={cx(SMALL_BUTTON, 'text-amber-200')} disabled={busy} onClick={() => onSlots((s) => levelUp(s, i))}>
                  Level up
                </button>
              )}
              {evolutionFor(slot) && (
                <ConfirmButton
                  tone="violet"
                  disabled={busy}
                  confirmLabel={`Yes, evolve (only undone by removing it)`}
                  onConfirm={() => onSlots((s) => evolve(s, i))}
                >
                  Evolve into {evolutionFor(slot)!.name}
                </ConfirmButton>
              )}
              <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => onSlots((s) => setSuppressed(s, i, !slot.suppressed))}>
                {slot.suppressed ? 'Unsuppress' : 'Suppress'}
              </button>
              {picked && (
                <ConfirmButton
                  tone="amber"
                  disabled={busy}
                  confirmLabel={`Yes, replace with ${boon(picked).name} at Level 1`}
                  onConfirm={() => onSlots((s) => replaceBoon(s, i, picked))}
                >
                  Replace with {boon(picked).name}
                </ConfirmButton>
              )}
              <ConfirmButton disabled={busy} confirmLabel={`Yes, remove ${slotName(slot)}`} onConfirm={() => onSlots((s) => clearSlot(s, i))}>
                Remove
              </ConfirmButton>
            </SlotCard>
          ),
        )}
      </ol>

      {combos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {combos.map(({ combination: c }) => (
            <ConfirmButton
              key={c.id}
              tone="emerald"
              disabled={busy}
              confirmLabel={`Yes, fuse (final, frees a slot)`}
              onConfirm={() => onSlots((s) => combine(s, c.id))}
            >
              Fuse {c.boons.map((b) => boon(b).name).join(' + ')} into {c.name}
            </ConfirmButton>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5 rounded-lg border border-stone-800 bg-stone-950/50 p-2.5">
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-stone-400">Add a boon by hand</span>
        <div className="flex flex-wrap gap-1.5">
          <select value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Pick a boon" className={cx(FIELD, 'min-w-0 flex-1 py-1.5 text-xs')}>
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
            className={SMALL_BUTTON}
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
          <div className="flex flex-col gap-1 text-[0.6875rem] text-stone-300">
            <span>{boon(picked).levels[0]}</span>
            {fitWarnings(picked, character).map((w) => (
              <span key={w} className="text-amber-300">
                {w}
              </span>
            ))}
            {!pickedIsHeld && !hasEmpty && <span className="text-amber-300">No empty slot: use Replace on a slot above.</span>}
          </div>
        )}
      </div>

      <HiddenSlot hiddenBoonId={player.hiddenBoonId}>
        <div className="flex flex-wrap gap-1.5">
          <select value={hiddenPick} onChange={(e) => setHiddenPick(e.target.value)} aria-label="Pick a hidden boon" className={cx(FIELD, 'min-w-0 flex-1 py-1.5 text-xs')}>
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
          {player.hiddenBoonId ? (
            <ConfirmButton
              tone="violet"
              disabled={busy || !hiddenPick}
              confirmLabel={hiddenPick ? `Yes, replace with ${hiddenBoon(hiddenPick).name}` : 'Yes, replace'}
              onConfirm={() => {
                act((s) => setHiddenBoon(s, id, hiddenPick))
                setHiddenPick('')
              }}
            >
              Replace hidden boon
            </ConfirmButton>
          ) : (
            <button
              type="button"
              className={SMALL_BUTTON}
              disabled={busy || !hiddenPick}
              onClick={() => {
                act((s) => setHiddenBoon(s, id, hiddenPick))
                setHiddenPick('')
              }}
            >
              Set hidden boon
            </button>
          )}
          {player.hiddenBoonId && (
            <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => act((s) => setHiddenBoon(s, id, null))}>
              Clear
            </button>
          )}
        </div>
      </HiddenSlot>
    </div>
  )
}
