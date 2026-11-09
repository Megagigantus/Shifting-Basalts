// What an invited player sees: their own characters (with stat tracks and
// upgrades to spend on) and the run their character is in, if any.
// The DM can also open this read-only via "View as player".
import { useState } from 'react'
import classes from '../data/classes.json'
import type { Character } from '../model/character'
import { proficiencyBonus } from '../rules/proficiency'
import { rankProgress, STAT_TRACKS, effectAtRank } from '../rules/statTracks'
import { useActiveRun } from '../runStore'
import { useCharacters } from '../useCharacters'
import { PlayerRun } from './PlayerRun'
import { StatTracks } from './StatTracks'
import { UpgradeShop } from './UpgradeShop'

const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id

/** What the dungeon adds to this character, as modifiers for their own sheet. */
function trackEffects(c: Character): string[] {
  return STAT_TRACKS.map((t) => effectAtRank(t, rankProgress(c.trackDevotions[t.id] ?? 0).rank)).filter(
    (e): e is string => e !== null,
  )
}

interface Props {
  email: string
  /** True for the DM's preview: everything shows, nothing can be spent. */
  readOnly?: boolean
}

export function PlayerHome({ email, readOnly = false }: Props) {
  const { characters, error } = useCharacters()
  const { state } = useActiveRun()
  const [open, setOpen] = useState<{ id: string; kind: 'tracks' | 'upgrades' } | null>(null)

  const mine = (characters ?? []).filter((c) => c.playerEmail === email.toLowerCase())
  const myIds = mine.map((c) => c.id)
  const myRun = state && state.run.characterIds.some((id) => myIds.includes(id)) ? state : null

  return (
    <>
      {myRun && <PlayerRun state={myRun} myCharacterIds={myIds} />}

      <section className="panel">
        <h2>{mine.length === 1 ? 'Your character' : 'Your characters'}</h2>
        {characters === null && !error && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {characters && mine.length === 0 && (
          <p className="hint">
            Your DM hasn't assigned you a character yet. They set the player email on your character to{' '}
            {email.toLowerCase()}.
          </p>
        )}
        {!myRun && mine.length > 0 && <p className="hint">You're not in a run right now.</p>}

        <ul className="character-list">
          {mine.map((c) => (
            <li key={c.id} className="character-row">
              <div className="character-main">
                <strong>{c.name}</strong>
                <span>
                  {className(c.classId)}
                  {c.subclass && ` (${c.subclass})`} · Level {c.level} · PB +{proficiencyBonus(c.level)}
                </span>
                <span>
                  <strong>{c.bankedQuantumBasalts}</strong> Quantum Basalts · <strong>{c.bankedDevotions}</strong>{' '}
                  Devotions to spend · deepest floor {c.deepestFloor || 'none yet'}
                </span>
                {trackEffects(c).length > 0 && (
                  <span className="hint">In the Basalts, add to your sheet: {trackEffects(c).join(' · ')}</span>
                )}
                {c.lockoutDays > 0 && <span className="warning">Locked out: {c.lockoutDays} days</span>}
                {open?.id === c.id && open.kind === 'tracks' && (
                  <StatTracks character={c} onClose={() => setOpen(null)} canCorrect={false} canSpend={!readOnly} />
                )}
                {open?.id === c.id && open.kind === 'upgrades' && (
                  <UpgradeShop character={c} onClose={() => setOpen(null)} canCorrect={false} canSpend={!readOnly} />
                )}
              </div>
              {open?.id !== c.id && (
                <div className="row-actions">
                  <button type="button" onClick={() => setOpen({ id: c.id, kind: 'tracks' })}>
                    Stat tracks
                  </button>
                  <button type="button" onClick={() => setOpen({ id: c.id, kind: 'upgrades' })}>
                    Upgrades
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
