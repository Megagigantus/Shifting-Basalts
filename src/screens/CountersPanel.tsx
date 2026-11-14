// Boon counters for one player. The DM edits them; players see them.
import { useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import { removeCounter, setCounter } from '../rules/counters'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Pill } from '../ui/Pill'
import { FIELD, SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

type Act = (step: (s: RunState) => RunState, confirmText?: string) => void

/** Read-only list, for players. */
export function CounterList({ player }: { player: RunPlayer }) {
  const entries = Object.entries(player.counters ?? {})
  if (!entries.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([name, value]) => (
        <Pill key={name} tone="teal" mono>
          {name}: {value}
        </Pill>
      ))}
    </div>
  )
}

/** The DM's editor: − and + on each counter, remove, and add a new one. */
export function CountersEditor({ player, busy, act }: { player: RunPlayer; busy: boolean; act: Act }) {
  const [name, setName] = useState('')
  const entries = Object.entries(player.counters ?? {})
  const id = player.characterId
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-teal-500/25 bg-stone-950/50 p-2.5">
      <span className="text-[0.625rem] font-bold uppercase tracking-wider text-stone-400">Boon counters</span>
      {entries.map(([label, value]) => (
        <div key={label} className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-auto text-stone-200">
            {label}: <strong className="font-mono text-teal-200">{value}</strong>
          </span>
          <button
            type="button"
            className={SMALL_BUTTON}
            aria-label={`Lower ${label}`}
            disabled={busy || value === 0}
            onClick={() => act((s) => setCounter(s, id, label, value - 1))}
          >
            −
          </button>
          <button type="button" className={SMALL_BUTTON} aria-label={`Raise ${label}`} disabled={busy} onClick={() => act((s) => setCounter(s, id, label, value + 1))}>
            +
          </button>
          <ConfirmButton disabled={busy} confirmLabel="Yes, remove" onConfirm={() => act((s) => removeCounter(s, id, label))}>
            Remove
          </ConfirmButton>
        </div>
      ))}
      <form
        className="flex flex-wrap gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          act((s) => setCounter(s, id, name, 0))
          setName('')
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a counter, e.g. Banked echoes"
          maxLength={40}
          aria-label={`New counter for ${player.name}`}
          className={cx(FIELD, 'min-w-0 flex-1 py-1.5 text-xs')}
        />
        <button type="submit" className={SMALL_BUTTON} disabled={busy || !name.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}
