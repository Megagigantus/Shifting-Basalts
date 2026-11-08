// DM screen: the character roster. Characters are saved in the
// "characters" collection and stay in sync live.
import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import classes from '../data/classes.json'
import { CASTER_TYPES, emptyProfile, type Character, type CharacterProfile } from '../model/character'
import { proficiencyBonus } from '../rules/proficiency'
import { CharacterForm } from './CharacterForm'

const className = (id: string) => classes.find((c) => c.id === id)?.name ?? id

/** Pull only the profile fields out of a saved character, for the edit form. */
function profileOf({ id: _id, ...profile }: Character): CharacterProfile {
  return profile
}

export function Characters() {
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, 'characters'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ ...emptyProfile(), ...d.data(), id: d.id }) as Character)
        list.sort((a, b) => a.name.localeCompare(b.name))
        setCharacters(list)
      },
      () => setError('Could not load characters.'),
    )
  }, [])

  async function create(profile: CharacterProfile) {
    if (!db) return
    await addDoc(collection(db, 'characters'), {
      ...profile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setEditing(null)
  }

  async function update(id: string, profile: CharacterProfile) {
    if (!db) return
    await updateDoc(doc(db, 'characters', id), { ...profile, updatedAt: serverTimestamp() })
    setEditing(null)
  }

  async function remove(character: Character) {
    if (!db) return
    const sure = window.confirm(
      `Delete ${character.name}? This removes their saved profile and can't be undone.`,
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

      {characters === null && !error && <p>Loading…</p>}
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
              </div>
              {editing === null && (
                <div className="row-actions">
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

      {error && <p className="error">{error}</p>}
    </section>
  )
}
