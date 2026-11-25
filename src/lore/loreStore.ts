// Firestore store for the DM's lore deck, settings, banned terms, and player-safe summary.
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { parseBannedTerms } from './bannedTerms'
import { buildDeckExport, buildSummary, validateDeckFile } from './deckFile'
import type { LoreCard, LoreDeckFile, LoreGroup, LoreSettings, LoreState } from './types'

export const DEFAULT_LORE_SETTINGS: LoreSettings = {
  tierLimit: 'deep',
  deepPerRun: 1,
  anchor: { name: '', voiceNote: '' },
}

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

/** Default lore deck state when loreState/main has not been created yet. */
export function emptyLoreState(): LoreState {
  return {
    settings: copySettings(DEFAULT_LORE_SETTINGS),
    seen: {},
    bannedTerms: [],
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

  const bannedTerms = Array.isArray(raw.bannedTerms)
    ? raw.bannedTerms.filter((t): t is string => typeof t === 'string')
    : base.bannedTerms

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
    bannedTerms,
  }
}

/** Convert loreGroups snapshots into LoreGroup objects sorted by order, without the order field. */
export function groupsFromDocs(
  docs: readonly { id: string; data: () => Record<string, unknown> }[],
): LoreGroup[] {
  return docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .sort((a, b) => compareOrder(a.data.order, b.data.order, a.id, b.id))
    .map(({ id, data }) => ({
      id: typeof data.id === 'string' ? data.id : id,
      name: typeof data.name === 'string' ? data.name : '',
      description: typeof data.description === 'string' ? data.description : '',
      defaultImageUrl: typeof data.defaultImageUrl === 'string' ? data.defaultImageUrl : null,
      defaultImagePrompt:
        typeof data.defaultImagePrompt === 'string' ? data.defaultImagePrompt : '',
    }))
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
    imagePrompt: card.imagePrompt,
    imageUrl: card.imageUrl,
    order,
  }
  if (card.adHoc === true) {
    docData.adHoc = true
  }
  return docData
}

/** Import a validated lore deck, upserting groups and cards while keeping seen and bannedTerms. */
export async function importDeck(deck: LoreDeckFile): Promise<{ cards: number; groups: number }> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const batch = writeBatch(firestore)

  deck.groups.forEach((group, index) => {
    batch.set(doc(firestore, 'loreGroups', group.id), {
      id: group.id,
      name: group.name,
      description: group.description,
      defaultImageUrl: group.defaultImageUrl,
      defaultImagePrompt: group.defaultImagePrompt,
      order: index,
    })
  })

  deck.cards.forEach((card, index) => {
    const order = finiteOrder(card.order) ?? index
    batch.set(doc(firestore, 'loreCards', card.id), toCardDoc(card, order))
  })

  batch.set(
    doc(firestore, 'loreState', 'main'),
    { settings: copySettings(deck.settings) },
    { merge: true },
  )

  await batch.commit()
  await refreshSummary()
  return { cards: deck.cards.length, groups: deck.groups.length }
}

/** Validate and save a single lore card, returning validation errors without writing if invalid. */
export async function saveCard(card: LoreCard): Promise<string[]> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const [stateSnap, groupsSnap] = await Promise.all([
    getDoc(doc(firestore, 'loreState', 'main')),
    getDocs(collection(firestore, 'loreGroups')),
  ])
  const { settings, bannedTerms } = mergeLoreState(stateSnap.exists() ? stateSnap.data() : undefined)
  const groups = groupsFromDocs(groupsSnap.docs)

  const validation = validateDeckFile(
    { schemaVersion: 1, deck: 'card', settings, groups, cards: [card] },
    bannedTerms,
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
  await refreshSummary()
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

/** Parse banned terms text, merge into loreState/main, and return the term count. */
export async function saveBannedTerms(text: string): Promise<number> {
  if (!db) throw new Error('Firebase is not set up.')
  const bannedTerms = parseBannedTerms(text)
  await setDoc(doc(db, 'loreState', 'main'), { bannedTerms }, { merge: true })
  return bannedTerms.length
}

/** Clear the seen map on loreState/main, replacing it rather than merging. */
export async function resetSeen(): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  await setDoc(doc(db, 'loreState', 'main'), { seen: {} }, { mergeFields: ['seen'] })
}

/** Rebuild the player-safe loreSummary/main document from saved groups and cards. */
export async function refreshSummary(): Promise<void> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const [groupsSnap, cardsSnap] = await Promise.all([
    getDocs(collection(firestore, 'loreGroups')),
    getDocs(collection(firestore, 'loreCards')),
  ])
  const groups = groupsFromDocs(groupsSnap.docs)
  const cards = cardsFromDocs(cardsSnap.docs)
  await setDoc(doc(firestore, 'loreSummary', 'main'), buildSummary(groups, cards))
}

/** Export the current lore deck and settings as formatted JSON. */
export async function exportDeckJson(): Promise<string> {
  if (!db) throw new Error('Firebase is not set up.')
  const firestore = db
  const [stateSnap, groupsSnap, cardsSnap] = await Promise.all([
    getDoc(doc(firestore, 'loreState', 'main')),
    getDocs(collection(firestore, 'loreGroups')),
    getDocs(collection(firestore, 'loreCards')),
  ])
  const { settings } = mergeLoreState(stateSnap.exists() ? stateSnap.data() : undefined)
  const groups = groupsFromDocs(groupsSnap.docs)
  const cards = cardsFromDocs(cardsSnap.docs)
  return JSON.stringify(buildDeckExport(settings, groups, cards), null, 2) + '\n'
}
