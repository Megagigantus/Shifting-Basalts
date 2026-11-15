// Modal picker when a boss arena's Shift Action moves tokens only for
// creatures that fail a save. Affected tokens start ticked as failed; the DM
// unticks anyone who passed, then confirms.
import { useState } from 'react'
import { DIRECTIONS, type Direction } from '../rules/shiftEffects'
import { Modal } from '../ui/Modal'
import { FIELD, PRIMARY_BUTTON, SMALL_BUTTON, WELL } from '../ui/styles'

export interface SaveTarget {
  key: string
  label: string
}

interface Props {
  title: string
  saveLabel: string
  targets: SaveTarget[]
  notes: string[]
  direction?: Direction
  onDirectionChange?: (dir: Direction) => void
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
        {direction && onDirectionChange && (
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
        <p className="m-0 text-xs text-stone-300">
          <strong className="text-amber-200">{saveLabel}</strong>: untick anyone who passed their save. Ticked creatures fail and are moved.
        </p>
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
