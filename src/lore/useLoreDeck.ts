// Live DM view of the lore deck: embedded cards plus Firestore ad hoc cards, groups, state, and load error.
import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { EMBEDDED_LORE_DECK, withAdHocCards } from './deck'
import { cardsFromDocs, mergeLoreState } from './loreStore'
import type { LoreCard, LoreGroup, LoreState } from './types'

/** Combine the embedded deck with Firestore ad hoc loreCards and loreState/main, returning nulls when Firebase is unconfigured. */
export function useLoreDeck(): {
  cards: LoreCard[] | null
  groups: LoreGroup[] | null
  state: LoreState | null
  error: string | null
} {
  const [cards, setCards] = useState<LoreCard[] | null>(null)
  const [state, setState] = useState<LoreState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const groups = db ? EMBEDDED_LORE_DECK.groups : null

  useEffect(() => {
    if (!db) return
    const onError = () => setError('Could not load the lore deck.')
    const unsubCards = onSnapshot(
      collection(db, 'loreCards'),
      (snapshot) => setCards(withAdHocCards(EMBEDDED_LORE_DECK.cards, cardsFromDocs(snapshot.docs))),
      onError,
    )
    const unsubState = onSnapshot(
      doc(db, 'loreState', 'main'),
      (snapshot) => setState(mergeLoreState(snapshot.exists() ? snapshot.data() : undefined)),
      onError,
    )
    return () => {
      unsubCards()
      unsubState()
    }
  }, [])

  return { cards, groups, state, error }
}
