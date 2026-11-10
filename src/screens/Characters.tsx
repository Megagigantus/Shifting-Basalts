// DM screen: the character roster. Characters are saved in the
// "characters" collection and stay in sync live.
import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import classes from '../data/classes.json'
import {
  CASTER_TYPES,
  emptyDungeonLayer,
  emptyProfile,
  profileOf,
  type Character,
  type CharacterProfile,
} from '../model/character'
import { proficiencyBonus } from '../rules/proficiency'
import { useCharacters } from '../useCharacters'
import { CharacterForm } from './CharacterForm'
import { StatTracks } from './StatTracks'
import { UpgradeShop } from './UpgradeShop'
import { DraftPreferences } from './DraftPreferences'
import { CharacterLoot } from './LootScreens'
import { UPGRADES } from '../rules/upgrades'

/** e.g. "Forge · Extra Boon Slot 2", for upgrades owned. */
function upgradeSummary(c: Character): string {
  return UPGRADES.filter((u) => (c.upgrades[u.id] ?? 0) > 0)
    .map((u) => (u.costs.length > 1 ? `${u.name} ${c.upgrades[u.id]}` : u.name))
    .join(' · ')
}
import { rankProgress, STAT_TRACKS } from '../rules/statTracks'

/** e.g. "Max HP 2 · Speed 1", for tracks with at least one rank. */
function trackSummary(c: Character): string {
  return STAT_TRACKS.map((t) => ({ name: t.name, rank: rankProgress(c.trackDevotions[t.id] ?? 0).rank }))
    .filter((t) => t.rank > 0)
    .map((t) => `${t.name} ${t.rank}`)
    .join(' · ')
}

const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id

export function Characters() {
  const { characters, error: loadError } = useCharacters()
  const [editing, setEditing] = useState<'new' | string | null>(null)
  // Which character's Stat tracks or Upgrades panel is open, if any.
  const [open, setOpen] = useState<{ id: string; kind: 'tracks' | 'upgrades' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function create(profile: CharacterProfile) {
    if (!db) return
    await addDoc(collection(db, 'characters'), {
      ...profile,
      ...emptyDungeonLayer(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setEditing(null)
  }

  async function update(id: string, profile: CharacterProfile) {
    if (!db) return
    // Only profile fields: runs own the dungeon layer.
    await updateDoc(doc(db, 'characters', id), { ...profile, updatedAt: serverTimestamp() })
    setEditing(null)
  }

  async function clearLockout(character: Character) {
    if (!db) return
    if (!window.confirm(`Clear ${character.name}'s lockout so they can enter the Basalts again?`)) return
    setError(null)
    try {
      await updateDoc(doc(db, 'characters', character.id), { lockoutDays: 0, updatedAt: serverTimestamp() })
    } catch {
      setError(`Could not clear ${character.name}'s lockout.`)
    }
  }

  async function remove(character: Character) {
    if (!db) return
    const sure = window.confirm(
      `Delete ${character.name}? This removes their saved profile and dungeon progress, and can't be undone.`,
    )
    if (!sure) return
    setError(null)
    try {
      await deleteDoc(doc(db, 'characters', character.id))
    } catch {
      setError(`Could not delete ${character.name}.`)
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Characters</h2>
        {editing === null && (
          <button type="button" onClick={() => setEditing('new')}>
            New character
          </button>
        )}
      </div>

      {editing === 'new' && (
        <CharacterForm
          title="New character"
          initial={emptyProfile()}
          onSave={create}
          onCancel={() => setEditing(null)}
        />
      )}

      {characters === null && !loadError && <p>Loading…</p>}
      {characters?.length === 0 && editing !== 'new' && (
        <p className="hint">No characters yet. Add one to get started.</p>
      )}

      <ul className="character-list">
        {characters?.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <CharacterForm
                title={`Edit ${c.name}`}
                initial={profileOf(c)}
                onSave={(profile) => update(c.id, profile)}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={c.id} className="character-row">
              <div className="character-main">
                <strong>{c.name}</strong>
                <span>
                  {className(c.classId)}
                  {c.subclass && ` (${c.subclass})`} · Level {c.level} · PB +{proficiencyBonus(c.level)}
                </span>
                <span className="hint">
                  {CASTER_TYPES.find((t) => t.id === c.casterType)?.label}
                  {c.slotLevels.length > 0 && ` (slots ${c.slotLevels.join(', ')})`}
                  {c.hasSummon && ' · summon/companion'}
                  {' · '}
                  {c.playerEmail || 'no player assigned'}
                </span>
                <span className="hint">
                  {c.bankedQuantumBasalts} Quantum Basalts · {c.bankedDevotions} Devotions banked ·
                  deepest floor {c.deepestFloor || 'none yet'}
                </span>
                {trackSummary(c) && <span className="hint">Stat tracks: {trackSummary(c)}</span>}
                {c.lockoutDays > 0 && (
                  <span className="warning">Locked out: {c.lockoutDays} days</span>
                )}
                <DraftPreferences character={c} />
                {upgradeSummary(c) && <span className="hint">Upgrades: {upgradeSummary(c)}</span>}
                <CharacterLoot loot={c.loot} />
                {open?.id === c.id && open.kind === 'tracks' && (
                  <StatTracks character={c} onClose={() => setOpen(null)} />
                )}
                {open?.id === c.id && open.kind === 'upgrades' && (
                  <UpgradeShop character={c} onClose={() => setOpen(null)} />
                )}
              </div>
              {editing === null && open?.id !== c.id && (
                <div className="row-actions">
                  <button type="button" onClick={() => setOpen({ id: c.id, kind: 'tracks' })}>
                    Stat tracks
                  </button>
                  <button type="button" onClick={() => setOpen({ id: c.id, kind: 'upgrades' })}>
                    Upgrades
                  </button>
                  {c.lockoutDays > 0 && (
                    <button type="button" onClick={() => clearLockout(c)}>
                      Clear lockout
                    </button>
                  )}
                  <button type="button" onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(c)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {(error || loadError) && <p className="error">{error || loadError}</p>}
    </section>
  )
}
