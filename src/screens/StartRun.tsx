// DM screen: pick who's entering and which Pressures, then start a run.
import { useState } from 'react'
import type { Character } from '../model/character'
import {
  availablePressures,
  entryMultiplier,
  partyLevel,
  pressureBonusPercent,
  PRESSURES,
  togglePressure,
} from '../rules/run'
import { makeJoinCode, newRunState } from '../rules/runFlow'
import { deepPocketsPercent, extraPressuresBonusPercent } from '../rules/upgrades'
import { newRunId, saveRunState } from '../runStore'

const EXTRA_PRESSURES = 'extra-pressures'

interface Props {
  characters: Character[]
  onStarted: () => void
  onCancel: () => void
}

export function StartRun({ characters, onStarted, onCancel }: Props) {
  const [picked, setPicked] = useState<string[]>([])
  const [pressures, setPressures] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const party = characters.filter((c) => picked.includes(c.id))
  const level = partyLevel(party.map((c) => c.level))
  // Extra Pressures is party-wide: the highest rank anyone in the party owns applies.
  const extraRank = Math.max(0, ...party.map((c) => c.upgrades[EXTRA_PRESSURES] ?? 0))
  const unlocked = new Set(availablePressures(extraRank).map((p) => p.id))
  // Drop any picked Pressure that's no longer unlocked (e.g. its owner was unticked).
  const activePressures = pressures.filter((id) => unlocked.has(id))

  function toggleCharacter(id: string) {
    setPicked((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))
  }

  async function start() {
    setError(null)
    if (party.length === 0) return setError('Pick at least one character.')
    setStarting(true)
    try {
      const state = newRunState(newRunId(), makeJoinCode(), party, activePressures)
      await saveRunState(state, null, characters)
      // The live listener picks up the new run and shows the tracker.
      onStarted()
    } catch {
      setError('Could not start the run. Please try again.')
      setStarting(false)
    }
  }

  return (
    <div className="start-run">
      <h3>Who's entering?</h3>
      {characters.length === 0 && <p className="hint">Add characters first.</p>}
      <div className="choice-list">
        {characters.map((c) => {
          const locked = c.lockoutDays > 0
          return (
            <label key={c.id} className={`checkbox ${locked ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={picked.includes(c.id)}
                onChange={() => toggleCharacter(c.id)}
                disabled={locked}
              />
              {c.name} (level {c.level})
              {locked && <span className="warning"> locked out {c.lockoutDays} days</span>}
            </label>
          )
        })}
      </div>

      <h3>Pressures</h3>
      <div className="choice-list">
        {PRESSURES.map((p) => {
          const isUnlocked = unlocked.has(p.id)
          return (
            <label key={p.id} className={`checkbox ${isUnlocked ? '' : 'disabled'}`}>
              <input
                type="checkbox"
                checked={activePressures.includes(p.id)}
                onChange={() => setPressures((ids) => togglePressure(ids, p.id))}
                disabled={!isUnlocked}
              />
              <span>
                <strong>{p.name}</strong> +{p.bonusPercent}%: {p.effect}
                {!isUnlocked && (
                  <span className="hint"> (needs Extra Pressures rank {p.unlockRank})</span>
                )}
              </span>
            </label>
          )
        })}
      </div>

      {party.length > 0 && (
        <p className="summary">
          Party level {level} · {party.length} {party.length === 1 ? 'player' : 'players'} · rewards ×
          {entryMultiplier(level)} · Pressure bonus +{pressureBonusPercent(activePressures)}%
          {extraPressuresBonusPercent(party) > 0 && ` · Extra Pressures +${extraPressuresBonusPercent(party)}%`}
          {deepPocketsPercent(party) > 0 && ` · Deep Pockets +${deepPocketsPercent(party)}% loot kept`}
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" onClick={start} disabled={starting || party.length === 0}>
          {starting ? 'Starting…' : 'Enter the Basalts'}
        </button>
        <button type="button" onClick={onCancel} disabled={starting}>
          Cancel
        </button>
      </div>
    </div>
  )
}
