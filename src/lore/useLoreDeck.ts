// Live DM view of the lore deck: cards, groups, state, and load error.
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { cardsFromDocs, groupsFromDocs, mergeLoreState } from './loreStore'
import type { LoreCard, LoreGroup, LoreState } from './types'

/** Subscribe to loreCards, loreGroups, and loreState/main, returning nulls when Firebase is unconfigured. */
export function useLoreDeck(): {
  cards: LoreCard[] | null
  groups: LoreGroup[] | null
  state: LoreState | null
  error: string | null
} {
  const [cards, setCards] = useState<LoreCard[] | null>(null)
  const [groups, setGroups] = useState<LoreGroup[] | null>(null)
  const [state, setState] = useState<LoreState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!db) return
    const onError = () => setError('Could not load the lore deck.')
    const unsubCards = onSnapshot(
      collection(db, 'loreCards'),
      (snapshot) => setCards(cardsFromDocs(snapshot.docs)),
      onError,
    )
    const unsubGroups = onSnapshot(
      collection(db, 'loreGroups'),
      (snapshot) => setGroups(groupsFromDocs(snapshot.docs)),
      onError,
    )
    const unsubState = onSnapshot(
      doc(db, 'loreState', 'main'),
      (snapshot) => setState(mergeLoreState(snapshot.exists() ? snapshot.data() : undefined)),
      onError,
    )
    return () => {
      unsubCards()
      unsubGroups()
      unsubState()
    }
  }, [])

  return { cards, groups, state, error }
}
