// Live list of saved characters, sorted by name. Shared by the roster and run setup.
import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { emptyDungeonLayer, emptyProfile, type Character } from './model/character'
import { withPlayerCollections } from './rules/echoes'
import { hasLoreLaurel, useLoreProgress, useLoreSummary } from './lore/useLoreLibrary'

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
        // Basalt Echoes are per player: attach each player's collection across all their characters.
        setCharacters(withPlayerCollections(list))
      },
      () => setError('Could not load characters.'),
    )
  }, [])

  // The full-lore laurel is per player too: shown every lore card in the deck.
  const progress = useLoreProgress()
  const summary = useLoreSummary()
  const withLaurels = useMemo(
    () => characters?.map((c) => ({ ...c, loreLaurel: hasLoreLaurel(progress[(c.playerEmail ?? '').toLowerCase()], summary) })) ?? null,
    [characters, progress, summary],
  )

  return { characters: withLaurels, error }
}
