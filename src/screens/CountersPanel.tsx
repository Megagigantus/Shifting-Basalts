// Boon counters for one player. The DM edits them; players see them.
import { useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import { removeCounter, setCounter } from '../rules/counters'

type Act = (step: (s: RunState) => RunState, confirmText?: string) => void

/** Read-only list, for players. */
export function CounterList({ player }: { player: RunPlayer }) {
  const entries = Object.entries(player.counters ?? {})
  if (!entries.length) return null
  return <div className="hint">{entries.map(([name, value]) => `${name}: ${value}`).join(' · ')}</div>
}

/** The DM's editor: − and + on each counter, remove, and add a new one. */
export function CountersEditor({ player, busy, act }: { player: RunPlayer; busy: boolean; act: Act }) {
  const [name, setName] = useState('')
  const entries = Object.entries(player.counters ?? {})
  const id = player.characterId
  return (
    <div className="counters">
      {entries.map(([label, value]) => (
        <span key={label} className="counter">
          {label}: <strong>{value}</strong>{' '}
          <button type="button" className="quiet" disabled={busy || value === 0} onClick={() => act((s) => setCounter(s, id, label, value - 1))}>
            −
          </button>
          <button type="button" className="quiet" disabled={busy} onClick={() => act((s) => setCounter(s, id, label, value + 1))}>
            +
          </button>
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={() => act((s) => removeCounter(s, id, label), `Remove the "${label}" counter?`)}
          >
            remove
          </button>
        </span>
      ))}
      <form
        className="counter-add"
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
        />
        <button type="submit" className="quiet" disabled={busy || !name.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}
