// One player's draft offer and hidden offer, as cards. Used by the DM (who
// applies choices directly) and by players (whose choices are sent to the
// DM's app). The screen itself never changes the run; it calls onChoose.
import { useState } from 'react'
import type { RunPlayer } from '../model/run'
import type { Offer } from '../rules/draft'
import type { DraftChoice } from '../rules/draftChoice'
import { boon, combination, evolution, hiddenBoon, slotName, type Slot } from '../rules/boons'
import { offerArtRef } from '../boonLootArt'
import { describeHidden, describeOffer } from '../offerText'
import { Ban, EyeOff, RefreshCw, Sparkles } from 'lucide-react'
import { BoonIcon } from '../ui/BoonIcon'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Pill } from '../ui/Pill'
import { FIELD, PRIMARY_BUTTON, QUIET_BUTTON } from '../ui/styles'
import { cx, toneClasses, type Tone } from '../ui/tone'

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

const BANISH_BUTTON = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50'

export function DraftOffers({ player, passValue, rerollsLeft, busy, onChoose, who }: Props) {
  const slots: Slot[] = player.slots ?? []
  const hasEmpty = slots.some((s) => s === null)
  const [replaceSlot, setReplaceSlot] = useState<Record<number, number>>({})
  const [dropBoon, setDropBoon] = useState<Record<number, string>>({})
  const draft = player.draft
  const hidden = player.hiddenOffer

  if (!draft && !hidden) return null

  const banishSlots = player.draftProfile?.banishSlots ?? 0
  const banished = player.draftProfile?.banished ?? []
  const banishFull = banished.length >= banishSlots
  const passLabel = `Pass (+${passValue} Quantum Basalt${passValue === 1 ? '' : 's'})`

  return (
    <div className="flex flex-col gap-4">
      {draft && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 flex items-center gap-1.5 text-sm font-bold text-stone-100">
              <Sparkles size={14} className="text-amber-300" />
              {draft.starting
                ? who ? `${who}: Starting Boon` : 'Your Starting Boon'
                : who ? `${who}: choose a boon` : 'Choose a boon'}
            </h3>
            <span className="text-[0.6875rem] text-stone-400">
              {draft.starting
                ? 'Before room 1'
                : `Floor ${draft.floor}, ${draft.elite ? 'elite room' : `room ${draft.room}`}`}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {draft.offers.map((offer, i) => {
              const text = describeOffer(offer, slots)
              const needsReplace = text.needsSlot && !hasEmpty
              const target = replaceSlot[i] ?? 0
              const tone = offerTone(text.label)
              const banishable = banishSlots > 0 && offer.kind === 'boon' && offer.source !== 'held'
              const pickingDrop = dropBoon[i] !== undefined
              const selectedDrop = banished.includes(dropBoon[i]) ? dropBoon[i] : (banished[0] ?? '')
              const boonName = offerName(offer)
              return (
                <div key={i} className={cx('flex flex-col gap-2 rounded-xl border bg-stone-950/70 p-3', toneClasses[tone].border)}>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 p-1">
                      <BoonIcon art={offerArtRef(offer)} name={boonName} size="lg" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill tone={tone}>{text.label}</Pill>
                        {text.tag && <Pill>{text.tag}</Pill>}
                      </div>
                      <strong className="text-sm text-stone-50">{text.heading}</strong>
                    </div>
                  </div>
                  <p className="m-0 flex-1 text-xs text-stone-300">{text.text}</p>
                  {needsReplace ? (
                    <div className="flex flex-wrap gap-1.5">
                      <select
                        value={target}
                        onChange={(e) => setReplaceSlot({ ...replaceSlot, [i]: Number(e.target.value) })}
                        aria-label="Slot to replace"
                        className={cx(FIELD, 'min-w-0 flex-1 py-1.5 text-xs')}
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
                        className={PRIMARY_BUTTON}
                        onClick={() => onChoose({ action: 'take', index: i, replaceSlot: target })}
                      >
                        Take
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled={busy} className={cx(PRIMARY_BUTTON, 'self-start')} onClick={() => onChoose({ action: 'take', index: i })}>
                      Take
                    </button>
                  )}
                  {banishable && (
                    !banishFull ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ConfirmButton
                          tone="rose"
                          disabled={busy}
                          confirmLabel={`Yes, banish ${boonName}`}
                          onConfirm={() => onChoose({ action: 'banish', index: i })}
                        >
                          <Ban size={13} /> Banish
                        </ConfirmButton>
                      </div>
                    ) : pickingDrop ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={selectedDrop}
                          disabled={busy}
                          onChange={(e) => setDropBoon({ ...dropBoon, [i]: e.target.value })}
                          aria-label="Boon to drop from your Banish list"
                          className={cx(FIELD, 'min-w-0 flex-1 py-1.5 text-xs')}
                        >
                          {banished.map((id) => (
                            <option key={id} value={id}>
                              {boon(id).name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy || !selectedDrop}
                          onClick={() => {
                            setDropBoon((prev) => {
                              const next = { ...prev }
                              delete next[i]
                              return next
                            })
                            onChoose({ action: 'banish', index: i, dropBoonId: selectedDrop })
                          }}
                          className={cx(BANISH_BUTTON, 'border-0', toneClasses.rose.button)}
                        >
                          Banish {boonName}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setDropBoon((prev) => {
                              const next = { ...prev }
                              delete next[i]
                              return next
                            })
                          }
                          className={cx(BANISH_BUTTON, toneClasses.stone.button)}
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setDropBoon({ ...dropBoon, [i]: banished[0] ?? '' })}
                        className={cx(BANISH_BUTTON, 'self-start', toneClasses.stone.button)}
                      >
                        <Ban size={13} /> Banish
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={QUIET_BUTTON} onClick={() => onChoose({ action: 'pass' })}>
              {passLabel}
            </button>
            {rerollsLeft > 0 && (
              <button type="button" disabled={busy} className={QUIET_BUTTON} onClick={() => onChoose({ action: 'reroll' })}>
                <RefreshCw size={13} /> Reroll offer ({rerollsLeft} left this floor)
              </button>
            )}
          </div>
          {banishSlots > 0 && (
            <div
              className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-stone-400"
              title="Banished boons never appear in your offers. Banish a new boon card to add it; a full list drops the one you pick."
            >
              <span>
                Banish list ({banished.length} of {banishSlots})
              </span>
              {banished.length === 0 ? (
                <span>empty</span>
              ) : (
                banished.map((id) => (
                  <Pill key={id} tone="rose">
                    {boon(id).name}
                  </Pill>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {hidden && (
        <div className="flex flex-col gap-3 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3">
          <h3 className="m-0 flex items-center gap-1.5 text-sm font-bold text-violet-200">
            <EyeOff size={14} /> {who ? `${who}: hidden offer` : 'Hidden offer'}
          </h3>
          <p className="m-0 text-xs text-stone-300">
            Thils approves. Take one for your hidden slot
            {player.hiddenBoonId ? ` (replaces ${hiddenBoon(player.hiddenBoonId).name})` : ''}, or pass.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {[...(hidden.classBoon ? [hidden.classBoon] : []), ...hidden.gifts].map((id) => {
              const text = describeHidden(id)
              return (
                <div key={id} className="flex flex-col gap-2 rounded-xl border border-violet-500/30 bg-stone-950/70 p-3">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 p-1">
                      <BoonIcon art={{ kind: 'hidden', id }} name={text.heading} size="lg" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Pill tone="violet" className="self-start">
                        {id === hidden.classBoon ? 'Class hidden boon' : "Thils's gift"}
                      </Pill>
                      <strong className="text-sm text-stone-50">{text.heading}</strong>
                    </div>
                  </div>
                  <p className="m-0 flex-1 text-xs text-stone-300">{text.text}</p>
                  <button
                    type="button"
                    disabled={busy}
                    className={cx('inline-flex cursor-pointer items-center justify-center self-start rounded-lg border-0 px-4 py-2 text-sm font-bold disabled:opacity-60', toneClasses.violet.button)}
                    onClick={() => onChoose({ action: 'hidden', hiddenBoonId: id })}
                  >
                    Take
                  </button>
                </div>
              )
            })}
          </div>
          <button type="button" disabled={busy} className={cx(QUIET_BUTTON, 'self-start')} onClick={() => onChoose({ action: 'passHidden' })}>
            {passLabel}
          </button>
        </div>
      )}
    </div>
  )
}

function offerName(offer: Offer): string {
  if (offer.kind === 'evolution') return evolution(offer.evolutionId).name
  if (offer.kind === 'combination') return combination(offer.combinationId).name
  return boon(offer.boonId).name
}

/** Badge color for an offer: amber level-ups, violet evolutions, sky combinations, neutral new boons. */
function offerTone(label: string): Tone {
  if (label.startsWith('Level')) return 'amber'
  if (label.includes('Evolution')) return 'violet'
  if (label.includes('Combination')) return 'sky'
  return 'stone'
}
