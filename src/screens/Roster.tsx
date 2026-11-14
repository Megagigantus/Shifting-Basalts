// The list of characters on the left of the Characters screens: portrait,
// name, level and class, banked Quantum Basalts, and a lockout warning.
import type { Character } from '../model/character'
import classes from '../data/classes.json'
import { Avatar } from './LookPicker'
import { cx } from '../ui/tone'

const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id

interface Props {
  characters: Character[]
  selectedId: string | null
  onSelect: (id: string) => void
  title?: string
}

export function Roster({ characters, selectedId, onSelect, title = 'Strider roster' }: Props) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2">
      <span className="text-[0.625rem] font-bold uppercase tracking-wider text-stone-400">{title}</span>
      {characters.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-current={c.id === selectedId ? 'true' : undefined}
          onClick={() => onSelect(c.id)}
          className={cx(
            'flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
            c.id === selectedId ? 'border-amber-500/50 bg-amber-500/15' : 'border-stone-800 bg-stone-900/80 hover:border-stone-700',
          )}
        >
          <Avatar portrait={c.portrait} name={c.name} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-stone-100">{c.name}</span>
              <span className="shrink-0 font-mono text-[0.6875rem] font-bold text-purple-300">{c.bankedQuantumBasalts} QB</span>
            </span>
            <span className="truncate text-[0.6875rem] text-stone-400">
              Lv {c.level} {className(c.classId)}
            </span>
            {c.lockoutDays > 0 && <span className="text-[0.6875rem] font-semibold text-rose-300">Locked out {c.lockoutDays} days</span>}
          </span>
        </button>
      ))}
    </nav>
  )
}
