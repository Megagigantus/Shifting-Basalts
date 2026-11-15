// Before a run, a player marks the Pressures they'd like (design bible: Runs,
// Pressure votes). Shown on the player's home while their character isn't in
// a run. The list is what the group can pick: Pressures unlocked by the
// highest Extra Pressures rank among all characters. The DM sees the counts.
import { useState } from 'react'
import { Flame } from 'lucide-react'
import type { Character } from '../model/character'
import { setPressureWishes, usePressureWishes } from '../pressureWishes'
import { availablePressures } from '../rules/run'
import { Panel } from '../ui/Panel'
import { cx } from '../ui/tone'

const EXTRA_PRESSURES = 'extra-pressures'

export function PressureWishes({ character, everyone, readOnly }: { character: Character; everyone: Character[]; readOnly: boolean }) {
  const wishes = usePressureWishes()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (character.activeRunId) return null
  const rank = Math.max(0, ...everyone.map((c) => c.upgrades[EXTRA_PRESSURES] ?? 0))
  const options = availablePressures(rank)
  const mine = wishes[character.id] ?? []

  async function toggle(id: string) {
    if (readOnly) return
    setError(null)
    setBusy(true)
    try {
      await setPressureWishes(character.id, mine.includes(id) ? mine.filter((p) => p !== id) : [...mine, id])
    } catch {
      setError('Could not save your wishes. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      tone="rose"
      icon={<Flame size={15} />}
      title="Pressures for the next run"
      subtitle={`Tick the Pressures ${character.name} would like to face. Your DM sees the votes and makes the call.`}
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {options.map((p) => {
          const on = mine.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              disabled={busy || readOnly}
              onClick={() => toggle(p.id)}
              className={cx(
                'rounded-xl border p-3 text-left cursor-pointer transition-colors disabled:cursor-default',
                on ? 'border-rose-500/50 bg-rose-500/15' : 'border-stone-800 bg-stone-950/60 hover:border-stone-700',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cx('text-sm font-bold', on ? 'text-rose-200' : 'text-stone-100')}>{p.name}</span>
                <span className="font-mono text-xs font-bold text-emerald-300">+{p.bonusPercent}%</span>
              </span>
              <span className="mt-1 block text-[0.6875rem] text-stone-400">{p.effect}</span>
            </button>
          )
        })}
      </div>
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </Panel>
  )
}
