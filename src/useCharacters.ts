// Live list of saved characters, sorted by name. Shared by the roster and run setup.
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { emptyDungeonLayer, emptyProfile, type Character } from './model/character'

export function useCharacters(): { characters: Character[] | null; error: string | null } {
  const [characters, setCharacters] = useState<Character[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, 'characters'),
      (snapshot) => {
        const list = snapshot.docs.map(
          // Defaults first, so older saved characters pick up any new fields.
          (d) => ({ ...emptyProfile(), ...emptyDungeonLayer(), ...d.data(), id: d.id }) as Character,
        )
        list.sort((a, b) => a.name.localeCompare(b.name))
        setCharacters(list)
      },
      () => setError('Could not load characters.'),
    )
  }, [])

  return { characters, error }
}
