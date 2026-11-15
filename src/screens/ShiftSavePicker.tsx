// Modal picker when a boss arena's Shift Action needs DM input before
// applying: ticking who failed a save, picking a tilt direction, or choosing
// which Chorus member has the most HP for Perspective Collapse.
import { useState } from 'react'
import { DIRECTIONS, type Direction } from '../rules/shiftEffects'
import { Modal } from '../ui/Modal'
import { FIELD, PRIMARY_BUTTON, SMALL_BUTTON, WELL } from '../ui/styles'

export interface SaveTarget {
  key: string
  label: string
}

const WALL_WORD: Partial<Record<Direction, string>> = {
  N: 'north',
  E: 'east',
  S: 'south',
  W: 'west',
}

interface Props {
  title: string
  saveLabel?: string
  targets: SaveTarget[]
  notes: string[]
  direction?: Direction
  onDirectionChange?: (dir: Direction) => void
  anchors?: { key: string; label: string }[]
  anchor?: string
  onAnchorChange?: (key: string) => void
  onApply: (failedKeys: Set<string>) => void
  onCancel: () => void
}

export function ShiftSavePicker({
  title,
  saveLabel,
  targets,
  notes,
  direction,
  onDirectionChange,
  anchors,
  anchor,
  onAnchorChange,
  onApply,
  onCancel,
}: Props) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set(targets.map((t) => t.key)))

  function toggle(key: string) {
    setFailed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <div className="flex flex-col gap-3">
        {anchors && anchors.length >= 2 && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-300">
            <label className="flex items-center gap-2">
              Member with the most HP:
              <select
                value={anchor ?? anchors[0].key}
                onChange={(e) => onAnchorChange?.(e.target.value)}
                className={FIELD}
              >
                {anchors.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            {direction && WALL_WORD[direction] && (
              <span>Everyone falls toward the {WALL_WORD[direction]} wall</span>
            )}
          </div>
        )}
        {direction && onDirectionChange && !anchors?.length && (
          <label className="flex items-center gap-2 text-xs text-stone-300">
            Downhill:
            <select
              value={direction}
              onChange={(e) => onDirectionChange(e.target.value as Direction)}
              className={FIELD}
            >
              {DIRECTIONS.map((d) => (
                <option key={d.dir} value={d.dir}>
                  {d.dir}
                </option>
              ))}
            </select>
          </label>
        )}
        {saveLabel && (
          <p className="m-0 text-xs text-stone-300">
            <strong className="text-amber-200">{saveLabel}</strong>: untick anyone who passed their save. Ticked creatures fail and are moved.
          </p>
        )}
        {targets.length > 0 && (
          <div className={`${WELL} flex flex-col gap-2`}>
            {targets.map((t) => (
              <label key={t.key} className="flex cursor-pointer items-center gap-2 text-xs text-stone-100">
                <input
                  type="checkbox"
                  checked={failed.has(t.key)}
                  onChange={() => toggle(t.key)}
                  className="accent-amber-500"
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        )}
        {notes.length > 0 && (
          <ul className="m-0 list-disc flex flex-col gap-1 pl-4 text-xs text-stone-400">
            {notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={SMALL_BUTTON} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={() => onApply(new Set(targets.filter((t) => failed.has(t.key)).map((t) => t.key)))}
          >
            Apply shift
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Notes from a shift that applied without a save, e.g. someone crushed against a wall. */
export function ShiftNotes({ title, notes, onClose }: { title: string; notes: string[]; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <ul className="m-0 list-disc flex flex-col gap-1 pl-4 text-xs text-stone-300">
          {notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button type="button" className={PRIMARY_BUTTON} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </Modal>
  )
}
