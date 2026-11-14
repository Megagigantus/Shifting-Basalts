// DM screen: the character roster. Characters are saved in the
// "characters" collection and stay in sync live. A list on the left, the
// chosen character's hub (or the form) on the right.
import { useState } from 'react'
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { LockOpen, Pencil, Trash, UserPlus } from 'lucide-react'
import { db } from '../firebase'
import { emptyDungeonLayer, emptyProfile, profileOf, type CharacterProfile } from '../model/character'
import { useCharacters } from '../useCharacters'
import { CharacterForm } from './CharacterForm'
import { CharacterHub } from './CharacterHub'
import { Roster } from './Roster'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel } from '../ui/Panel'
import { PRIMARY_BUTTON, SMALL_BUTTON } from '../ui/styles'

export function Characters() {
  const { characters, error: loadError } = useCharacters()
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const current = characters?.find((c) => c.id === selected) ?? characters?.[0] ?? null

  async function create(profile: CharacterProfile) {
    if (!db) return
    const ref = await addDoc(collection(db, 'characters'), {
      ...profile,
      ...emptyDungeonLayer(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setEditing(null)
    setSelected(ref.id)
  }

  async function update(id: string, profile: CharacterProfile) {
    if (!db) return
    // Only profile fields: runs own the dungeon layer.
    await updateDoc(doc(db, 'characters', id), { ...profile, updatedAt: serverTimestamp() })
    setEditing(null)
  }

  async function clearLockout(id: string, name: string) {
    if (!db) return
    setError(null)
    try {
      await updateDoc(doc(db, 'characters', id), { lockoutDays: 0, updatedAt: serverTimestamp() })
    } catch {
      setError(`Could not clear ${name}'s lockout.`)
    }
  }

  async function remove(id: string, name: string) {
    if (!db) return
    setError(null)
    try {
      await deleteDoc(doc(db, 'characters', id))
      setSelected(null)
    } catch {
      setError(`Could not delete ${name}.`)
    }
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-3 lg:col-span-3">
        <button type="button" className={PRIMARY_BUTTON} disabled={editing !== null} onClick={() => setEditing('new')}>
          <UserPlus size={15} /> New character
        </button>
        {characters === null && !loadError && <p className="m-0 text-sm text-stone-400">Loading…</p>}
        {characters && (
          <Roster
            characters={characters}
            selectedId={editing === 'new' ? null : (current?.id ?? null)}
            onSelect={(id) => {
              setSelected(id)
              setEditing(null)
            }}
          />
        )}
        {characters?.length === 0 && <p className="m-0 text-xs text-stone-500">No characters yet. Add one to get started.</p>}
      </div>

      <div className="flex min-w-0 flex-col gap-4 lg:col-span-9">
        {(error || loadError) && <p className="m-0 text-sm text-rose-300">{error || loadError}</p>}

        {editing === 'new' && (
          <Panel hero tone="amber" title="New character">
            <CharacterForm initial={emptyProfile()} onSave={create} onCancel={() => setEditing(null)} />
          </Panel>
        )}

        {editing !== 'new' && current && editing === current.id && (
          <Panel hero tone="amber" title={`Edit ${current.name}`}>
            <CharacterForm initial={profileOf(current)} onSave={(profile) => update(current.id, profile)} onCancel={() => setEditing(null)} />
          </Panel>
        )}

        {editing === null && current && (
          <CharacterHub
            key={current.id}
            character={current}
            mode="dm"
            actions={
              <>
                <button type="button" className={SMALL_BUTTON} onClick={() => setEditing(current.id)}>
                  <Pencil size={12} /> Edit
                </button>
                {current.lockoutDays > 0 && (
                  <ConfirmButton tone="emerald" confirmLabel="Yes, clear it" onConfirm={() => clearLockout(current.id, current.name)}>
                    <LockOpen size={12} /> Clear lockout
                  </ConfirmButton>
                )}
                <ConfirmButton
                  confirmLabel={`Yes, delete ${current.name} forever`}
                  onConfirm={() => remove(current.id, current.name)}
                >
                  <Trash size={12} /> Delete
                </ConfirmButton>
              </>
            }
          />
        )}
      </div>
    </div>
  )
}
