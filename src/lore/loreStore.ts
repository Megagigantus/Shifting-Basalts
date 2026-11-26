// Firestore store for the DM's lore settings, seen cards, and ad hoc dispatch answer cards.
// The deck itself is embedded (src/data/lore-deck.json, loaded by ./deck).
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { EMBEDDED_LORE_DECK, LORE_BANNED_TERMS } from './deck'
import { validateDeckFile } from './deckFile'
import type { LoreCard, LoreSettings, LoreState } from './types'

function copySettings(settings: LoreSettings): LoreSettings {
  return {
    tierLimit: settings.tierLimit,
    deepPerRun: settings.deepPerRun,
    anchor: {
      name: settings.anchor.name,
      voiceNote: settings.anchor.voiceNote,
    },
  }
}

export const DEFAULT_LORE_SETTINGS: LoreSettings = copySettings(EMBEDDED_LORE_DECK.settings)

/** Default lore deck state when loreState/main has not been created yet. */
export function emptyLoreState(): LoreState {
  return {
    settings: copySettings(DEFAULT_LORE_SETTINGS),
    seen: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteOrder(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function compareOrder(aOrder: unknown, bOrder: unknown, aId: string, bId: string): number {
  const a = finiteOrder(aOrder)
  const b = finiteOrder(bOrder)
  if (a !== null && b !== null && a !== b) return a - b
  if ((a !== null) !== (b !== null)) return a !== null ? -1 : 1
  return aId < bId ? -1 : aId > bId ? 1 : 0
}

/** Merge a partial loreState/main document over emptyLoreState(), including nested settings and anchor. */
export function mergeLoreState(raw?: Record<string, unknown>): LoreState {
  const base = emptyLoreState()
  if (!raw) return base

  const rawSettings = isRecord(raw.settings) ? raw.settings : undefined
  const rawAnchor = rawSettings && isRecord(rawSettings.anchor) ? rawSettings.anchor : undefined
  const rawSeen = isRecord(raw.seen) ? raw.seen : undefined

  const seen: Record<string, number> = {}
  if (rawSeen) {
    for (const [cardId, timestamp] of Object.entries(rawSeen)) {
      if (typeof timestamp === 'number') {
        seen[cardId] = timestamp
      }
    }
  }

  return {
    settings: {
      tierLimit:
        rawSettings?.tierLimit === 'open' ||
        rawSettings?.tierLimit === 'guarded' ||
        rawSettings?.tierLimit === 'deep'
          ? rawSettings.tierLimit
          : base.settings.tierLimit,
      deepPerRun:
        typeof rawSettings?.deepPerRun === 'number'
          ? rawSettings.deepPerRun
          : base.settings.deepPerRun,
      anchor: {
        name: typeof rawAnchor?.name === 'string' ? rawAnchor.name : base.settings.anchor.name,
        voiceNote:
          typeof rawAnchor?.voiceNote === 'string'
            ? rawAnchor.voiceNote
            : base.settings.anchor.voiceNote,
      },
    },
    seen,
  }
}

/** Convert loreCards snapshots into LoreCard objects sorted by order then id. */
export function cardsFromDocs(
  docs: readonly { id: string; data: () => Record<string, unknown> }[],
): LoreCard[] {
  return docs
    .map((d) => ({ ...d.data(), id: d.id }) as LoreCard)
    .sort((a, b) => compareOrder(a.order, b.order, a.id, b.id))
}

function toCardDoc(card: LoreCard, order: number): Record<string, unknown> {
  const docData: Record<string, unknown> = {
    id: card.id,
    group: card.group,
    title: card.title,
    trigger: { key: card.trigger.key, label: card.trigger.label },
    repeat: card.repeat,
    tier: card.tier,
    source: card.source,
    readAloud: card.readAloud,
    push: card.push,
    dmTruth: card.dmTruth,
    placeholders: [...card.placeholders],
    imageUrl: card.imageUrl,
    order,
  }
  if (card.adHoc === true) {
    docData.adHoc = true
  }
  return docData
}

/** Validate and save a single lore card, returning validation errors without writing if invalid. */
export async function saveCard(card: LoreCard): Promise<string[]> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const stateSnap = await getDoc(doc(firestore, 'loreState', 'main'))
  const { settings } = mergeLoreState(stateSnap.exists() ? stateSnap.data() : undefined)

  // Checked against the embedded deck's groups and banned terms.
  const validation = validateDeckFile(
    { schemaVersion: 1, deck: 'card', settings, groups: EMBEDDED_LORE_DECK.groups, cards: [card] },
    LORE_BANNED_TERMS,
  )
  if (!validation.ok) return validation.errors

  let order = finiteOrder(card.order)
  if (order === null) {
    const cardsSnap = await getDocs(collection(firestore, 'loreCards'))
    const maxOrder = cardsSnap.docs.reduce((max, d) => {
      const value = finiteOrder(d.data().order)
      return value !== null && value > max ? value : max
    }, -1)
    order = maxOrder + 1
  }

  const cleanCard = validation.deck.cards[0]
  await setDoc(doc(firestore, 'loreCards', cleanCard.id), toCardDoc(cleanCard, order))
  return []
}

/** Merge updated lore deck settings into loreState/main. */
export async function saveSettings(settings: LoreSettings): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await setDoc(
    doc(db, 'loreState', 'main'),
    { settings: copySettings(settings) },
    { merge: true },
  )
}

/** Clear the seen map on loreState/main, replacing it rather than merging. */
export async function resetSeen(): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await setDoc(doc(db, 'loreState', 'main'), { seen: {} }, { mergeFields: ['seen'] })
}
