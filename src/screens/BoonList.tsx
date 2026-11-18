// Read-only view of one player's boons, for the player screens, plus the slot
// card both this list and the DM's boon editor use.
import type { ReactNode } from 'react'
import { EyeOff } from 'lucide-react'
import { slotArtRef } from '../boonLootArt'
import type { RunPlayer } from '../model/run'
import { hiddenBoon, slotName, slotRulesText, slotTags, type SlotContent } from '../rules/boons'
import { BoonIcon } from '../ui/BoonIcon'
import { Pill } from '../ui/Pill'
import { tagInfo } from '../tagInfo'
import { cx } from '../ui/tone'

/** One filled boon slot: name, level or kind, tags, Suppressed, rules text, and any buttons. */
export function SlotCard({ slot, children }: { slot: SlotContent; children?: ReactNode }) {
  return (
    <li
      className={cx(
        'flex items-start gap-2.5 rounded-lg border p-2.5',
        slot.suppressed ? 'border-dashed border-rose-500/40 bg-rose-950/20' : 'border-stone-800 bg-stone-950/70',
      )}
    >
      <div className="shrink-0 p-0.5">
        <BoonIcon art={slotArtRef(slot)} name={slotName(slot)} size="md" dimmed={slot.suppressed} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <strong className={cx('mr-1 text-xs', slot.suppressed ? 'text-stone-400 line-through' : 'text-stone-100')}>{slotName(slot)}</strong>
          {slot.kind === 'boon' && (
            <Pill tone="amber" mono>
              Lv {slot.level}
            </Pill>
          )}
          {slot.kind === 'evolution' && <Pill tone="violet">Evolution</Pill>}
          {slot.kind === 'combination' && <Pill tone="sky">Combination</Pill>}
          {slotTags(slot).map((t) => (
            <Pill key={t} title={tagInfo(t)} className="cursor-help">
              {t}
            </Pill>
          ))}
          {slot.suppressed && <Pill tone="rose">Suppressed</Pill>}
        </div>
        <details>
          <summary className="cursor-pointer text-[0.6875rem] text-stone-400">Rules text</summary>
          <div className="mt-1 flex flex-col gap-1">
            {slotRulesText(slot).map((line) => (
              <p key={line} className="m-0 text-[0.6875rem] text-stone-300">
                {line}
              </p>
            ))}
          </div>
        </details>
        {children && <div className="flex flex-wrap gap-1.5">{children}</div>}
      </div>
    </li>
  )
}

/** The hidden boon slot (violet), or "none". */
export function HiddenSlot({ hiddenBoonId, children }: { hiddenBoonId: string | null | undefined; children?: ReactNode }) {
  const hidden = hiddenBoonId ? hiddenBoon(hiddenBoonId) : null
  if (!hidden || !hiddenBoonId) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 p-2.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <EyeOff size={13} className="text-violet-300" />
          <span className="text-violet-200">Hidden boon:</span>
          <span className="text-stone-500">none</span>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-violet-500/30 bg-violet-500/10 p-2.5">
      <div className="shrink-0 p-0.5">
        <BoonIcon art={{ kind: 'hidden', id: hiddenBoonId }} name={hidden.name} size="md" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <EyeOff size={13} className="text-violet-300" />
          <span className="text-violet-200">Hidden boon:</span>
          <strong className="text-stone-100">{hidden.name}</strong>
        </div>
        <p className="m-0 text-[0.6875rem] text-stone-300">{hidden.effect}</p>
        {children}
      </div>
    </div>
  )
}

export function BoonList({ player }: { player: RunPlayer }) {
  const held = (player.slots ?? []).filter((s): s is SlotContent => s !== null)
  const total = player.slots?.length ?? 0

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.6875rem] text-stone-400">
        {held.length} of {total} boon slots filled
      </span>
      {held.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {held.map((slot, i) => (
            <SlotCard key={i} slot={slot} />
          ))}
        </ol>
      )}
      {player.hiddenBoonId && <HiddenSlot hiddenBoonId={player.hiddenBoonId} />}
    </div>
  )
}
