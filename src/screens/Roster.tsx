// The list of characters on the left of the Characters screens: portrait,
// name, level and class, banked Quantum Basalts, Fortune Dice per run, and a lockout warning.
import { Dices } from 'lucide-react'
import { portraitHonors } from '../rules/portraitHonors'
import { fortuneDicePerRun } from '../rules/fortune'
import { buildOf, type Character } from '../model/character'
import { buildSummary } from '../rules/build'
import { Avatar } from './LookPicker'
import { cx } from '../ui/tone'

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
          <Avatar portrait={c.portrait} name={c.name} honors={portraitHonors(c)} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-bold text-stone-100">{c.name}</span>
              <span className="flex shrink-0 items-center gap-2 font-mono text-[0.6875rem] font-bold">
                {fortuneDicePerRun(c.trackDevotions) > 0 && (
                  <span className="flex items-center gap-0.5 text-amber-300" title="Fortune Dice each run">
                    <Dices size={11} aria-hidden /> {fortuneDicePerRun(c.trackDevotions)}
                  </span>
                )}
                <span className="text-purple-300">{c.bankedQuantumBasalts} Quantum Basalts</span>
              </span>
            </span>
            <span className="truncate text-[0.6875rem] text-stone-400">
              Lv {c.level} · {buildSummary({ ...c, ...buildOf(c) })}
            </span>
            {c.lockoutDays > 0 && <span className="text-[0.6875rem] font-semibold text-rose-300">Locked out {c.lockoutDays} days</span>}
          </span>
        </button>
      ))}
    </nav>
  )
}
