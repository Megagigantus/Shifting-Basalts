// Pure validation, export, and player-safe summary builders for lore deck files.
// Browser-safe: no Firebase, React, or Node imports. Never logs card text.
import { findBannedInCard, findBannedTerms } from './bannedTerms.ts'
import type {
  LoreCard,
  LoreDeckFile,
  LoreGroup,
  LoreRepeat,
  LoreSettings,
  LoreSource,
  LoreSummary,
  LoreTier,
} from './types.ts'

const VALID_TIERS = new Set<LoreTier>(['open', 'guarded', 'deep'])
const VALID_REPEATS = new Set<LoreRepeat>(['once_campaign', 'once_run', 'repeatable'])
const VALID_SOURCES = new Set<LoreSource>(['canon', 'loremaster', 'both'])
const ID_PATTERN = /^[a-z0-9-]+$/
const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/g

export type DeckValidationResult =
  | { ok: true; deck: LoreDeckFile }
  | { ok: false; errors: string[] }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isEnumValue<T extends string>(value: unknown, allowed: Set<T>): value is T {
  return typeof value === 'string' && allowed.has(value as T)
}

function validateSettings(
  raw: unknown,
  bannedTerms: string[],
  errors: string[],
): LoreSettings | null {
  if (!isPlainObject(raw)) {
    errors.push('settings: must be an object')
    return null
  }

  let valid = true

  const tierLimit = raw.tierLimit
  if (!isEnumValue(tierLimit, VALID_TIERS)) {
    errors.push('settings.tierLimit: must be open, guarded, or deep')
    valid = false
  }

  const deepPerRun = raw.deepPerRun
  if (typeof deepPerRun !== 'number' || !Number.isInteger(deepPerRun) || deepPerRun < 0) {
    errors.push('settings.deepPerRun: must be an integer >= 0')
    valid = false
  }

  let cleanAnchor: { name: string; voiceNote: string } | null = null
  if (!isPlainObject(raw.anchor)) {
    errors.push('settings.anchor: must be an object')
    valid = false
  } else {
    const { name, voiceNote } = raw.anchor
    if (typeof name !== 'string') {
      errors.push('settings.anchor.name: must be a string')
      valid = false
    }
    if (typeof voiceNote !== 'string') {
      errors.push('settings.anchor.voiceNote: must be a string')
      valid = false
    }
    if (typeof name === 'string' && typeof voiceNote === 'string') {
      cleanAnchor = { name, voiceNote }
    }
  }

  for (const hit of findBannedTerms(raw, bannedTerms)) {
    errors.push(`settings: banned term in ${hit.path} (${hit.term})`)
  }

  if (
    !valid ||
    !isEnumValue(tierLimit, VALID_TIERS) ||
    typeof deepPerRun !== 'number' ||
    !cleanAnchor
  ) {
    return null
  }

  return {
    tierLimit,
    deepPerRun,
    anchor: cleanAnchor,
  }
}

function validateGroup(
  raw: unknown,
  index: number,
  seenIds: Set<string>,
  bannedTerms: string[],
  errors: string[],
): LoreGroup | null {
  if (!isPlainObject(raw)) {
    errors.push(`groups[${index}]: must be an object`)
    return null
  }

  const validId = isValidId(raw.id)
  const label = validId ? `group ${raw.id}` : `groups[${index}]`
  let valid = true

  if (!validId) {
    errors.push(`${label}: id must be non-empty lowercase letters, digits, and dashes`)
    valid = false
  } else if (seenIds.has(raw.id as string)) {
    errors.push(`${label}: duplicate group id`)
    valid = false
  } else {
    seenIds.add(raw.id as string)
  }

  if (typeof raw.name !== 'string') {
    errors.push(`${label}: name must be a string`)
    valid = false
  }
  if (typeof raw.description !== 'string') {
    errors.push(`${label}: description must be a string`)
    valid = false
  }
  if (typeof raw.defaultImagePrompt !== 'string') {
    errors.push(`${label}: defaultImagePrompt must be a string`)
    valid = false
  }
  if (!isStringOrNull(raw.defaultImageUrl)) {
    errors.push(`${label}: defaultImageUrl must be a string or null`)
    valid = false
  }

  for (const hit of findBannedTerms(raw, bannedTerms)) {
    errors.push(`${label}: banned term in ${hit.path} (${hit.term})`)
  }

  if (
    !valid ||
    !validId ||
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.description !== 'string' ||
    typeof raw.defaultImagePrompt !== 'string' ||
    !isStringOrNull(raw.defaultImageUrl)
  ) {
    return null
  }

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    defaultImageUrl: raw.defaultImageUrl,
    defaultImagePrompt: raw.defaultImagePrompt,
  }
}

function validatePlaceholders(
  readAloud: string,
  placeholders: string[],
  label: string,
  errors: string[],
): boolean {
  const inReadAloud = new Set<string>()
  for (const match of readAloud.matchAll(PLACEHOLDER_PATTERN)) {
    inReadAloud.add(match[1])
  }
  const listed = new Set(placeholders)
  let valid = true

  for (const name of inReadAloud) {
    if (!listed.has(name)) {
      errors.push(`${label}: readAloud contains placeholder not listed in placeholders`)
      valid = false
      break
    }
  }

  for (const name of placeholders) {
    if (!inReadAloud.has(name)) {
      errors.push(`${label}: placeholders contains entry missing from readAloud`)
      valid = false
      break
    }
  }

  return valid
}

function validateCard(
  raw: unknown,
  index: number,
  seenCardIds: Set<string>,
  groupIds: Set<string> | null,
  bannedTerms: string[],
  errors: string[],
): LoreCard | null {
  if (!isPlainObject(raw)) {
    errors.push(`cards[${index}]: must be an object`)
    return null
  }

  const validId = isValidId(raw.id)
  const label = validId ? `card ${raw.id}` : `cards[${index}]`
  let valid = true

  if (!validId) {
    errors.push(`${label}: id must be non-empty lowercase letters, digits, and dashes`)
    valid = false
  } else if (seenCardIds.has(raw.id as string)) {
    errors.push(`${label}: duplicate card id`)
    valid = false
  } else {
    seenCardIds.add(raw.id as string)
  }

  if (typeof raw.group !== 'string') {
    errors.push(`${label}: group must be a string`)
    valid = false
  } else if (groupIds !== null && !groupIds.has(raw.group)) {
    errors.push(`${label}: unknown group`)
    valid = false
  }

  if (!isNonEmptyString(raw.title)) {
    errors.push(`${label}: title must be a non-empty string`)
    valid = false
  }

  let cleanTrigger: { key: string; label: string } | null = null
  if (!isPlainObject(raw.trigger)) {
    errors.push(`${label}: trigger must be an object`)
    valid = false
  } else {
    const { key, label: triggerLabel } = raw.trigger
    if (!isNonEmptyString(key)) {
      errors.push(`${label}: trigger.key must be a non-empty string`)
      valid = false
    }
    if (!isNonEmptyString(triggerLabel)) {
      errors.push(`${label}: trigger.label must be a non-empty string`)
      valid = false
    }
    if (isNonEmptyString(key) && isNonEmptyString(triggerLabel)) {
      cleanTrigger = { key, label: triggerLabel }
    }
  }

  if (!isEnumValue(raw.repeat, VALID_REPEATS)) {
    errors.push(`${label}: repeat must be once_campaign, once_run, or repeatable`)
    valid = false
  }
  if (!isEnumValue(raw.tier, VALID_TIERS)) {
    errors.push(`${label}: tier must be open, guarded, or deep`)
    valid = false
  }
  if (!isEnumValue(raw.source, VALID_SOURCES)) {
    errors.push(`${label}: source must be canon, loremaster, or both`)
    valid = false
  }

  if (typeof raw.readAloud !== 'string') {
    errors.push(`${label}: readAloud must be a string`)
    valid = false
  }
  if (typeof raw.push !== 'string') {
    errors.push(`${label}: push must be a string`)
    valid = false
  }
  if (typeof raw.dmTruth !== 'string') {
    errors.push(`${label}: dmTruth must be a string`)
    valid = false
  }

  let cleanPlaceholders: string[] | null = null
  if (
    !Array.isArray(raw.placeholders) ||
    !raw.placeholders.every((entry): entry is string => typeof entry === 'string')
  ) {
    errors.push(`${label}: placeholders must be an array of strings`)
    valid = false
  } else {
    cleanPlaceholders = [...raw.placeholders]
  }

  if (typeof raw.readAloud === 'string' && cleanPlaceholders !== null) {
    if (!validatePlaceholders(raw.readAloud, cleanPlaceholders, label, errors)) {
      valid = false
    }
  }

  if (typeof raw.imagePrompt !== 'string') {
    errors.push(`${label}: imagePrompt must be a string`)
    valid = false
  }
  if (!isStringOrNull(raw.imageUrl)) {
    errors.push(`${label}: imageUrl must be a string or null`)
    valid = false
  }
  if (raw.adHoc !== undefined && typeof raw.adHoc !== 'boolean') {
    errors.push(`${label}: adHoc must be a boolean`)
    valid = false
  }

  for (const hit of findBannedInCard(raw as unknown as LoreCard, bannedTerms)) {
    errors.push(`${label}: banned term in ${hit.path} (${hit.term})`)
  }

  if (
    !valid ||
    !validId ||
    typeof raw.id !== 'string' ||
    typeof raw.group !== 'string' ||
    !isNonEmptyString(raw.title) ||
    !cleanTrigger ||
    !isEnumValue(raw.repeat, VALID_REPEATS) ||
    !isEnumValue(raw.tier, VALID_TIERS) ||
    !isEnumValue(raw.source, VALID_SOURCES) ||
    typeof raw.readAloud !== 'string' ||
    typeof raw.push !== 'string' ||
    typeof raw.dmTruth !== 'string' ||
    cleanPlaceholders === null ||
    typeof raw.imagePrompt !== 'string' ||
    !isStringOrNull(raw.imageUrl)
  ) {
    return null
  }

  const card: LoreCard = {
    id: raw.id,
    group: raw.group,
    title: raw.title,
    trigger: cleanTrigger,
    repeat: raw.repeat,
    tier: raw.tier,
    source: raw.source,
    readAloud: raw.readAloud,
    push: raw.push,
    dmTruth: raw.dmTruth,
    placeholders: cleanPlaceholders,
    imagePrompt: raw.imagePrompt,
    imageUrl: raw.imageUrl,
    order: index,
  }

  if (typeof raw.adHoc === 'boolean') {
    card.adHoc = raw.adHoc
  }

  return card
}

/**
 * Validate an imported lore deck JSON object, collecting all structural,
 * placeholder, and banned-term errors without leaking card field contents.
 */
export function validateDeckFile(
  raw: unknown,
  bannedTerms: string[],
): DeckValidationResult {
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['deck file must be a JSON object'] }
  }

  const errors: string[] = []

  if (raw.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1')
  }
  if (typeof raw.deck !== 'string') {
    errors.push('deck must be a string')
  }

  const cleanSettings = validateSettings(raw.settings, bannedTerms, errors)

  const seenGroupIds = new Set<string>()
  const cleanGroups: LoreGroup[] = []
  const hasGroupsArray = Array.isArray(raw.groups)
  if (!hasGroupsArray) {
    errors.push('groups must be an array')
  } else {
    const groups = raw.groups as unknown[]
    for (let i = 0; i < groups.length; i += 1) {
      const group = validateGroup(groups[i], i, seenGroupIds, bannedTerms, errors)
      if (group) cleanGroups.push(group)
    }
  }

  const seenCardIds = new Set<string>()
  const cleanCards: LoreCard[] = []
  if (!Array.isArray(raw.cards)) {
    errors.push('cards must be an array')
  } else {
    const groupIdsForCards = hasGroupsArray ? seenGroupIds : null
    for (let i = 0; i < raw.cards.length; i += 1) {
      const card = validateCard(
        raw.cards[i],
        i,
        seenCardIds,
        groupIdsForCards,
        bannedTerms,
        errors,
      )
      if (card) cleanCards.push(card)
    }
  }

  if (errors.length > 0 || !cleanSettings || typeof raw.deck !== 'string') {
    return { ok: false, errors }
  }

  return {
    ok: true,
    deck: {
      schemaVersion: 1,
      deck: raw.deck,
      settings: cleanSettings,
      groups: cleanGroups,
      cards: cleanCards,
    },
  }
}

function compareCardsForExport(a: LoreCard, b: LoreCard): number {
  const aHasOrder = typeof a.order === 'number' && Number.isFinite(a.order)
  const bHasOrder = typeof b.order === 'number' && Number.isFinite(b.order)

  if (aHasOrder && bHasOrder && a.order !== b.order) {
    return (a.order as number) - (b.order as number)
  }
  if (aHasOrder !== bHasOrder) {
    return aHasOrder ? -1 : 1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Build a clean LoreDeckFile for export, sorting cards by order (with
 * unordered cards last, then by id), stripping `order`, and keeping `adHoc`
 * only when true.
 */
export function buildDeckExport(
  settings: LoreSettings,
  groups: LoreGroup[],
  cards: LoreCard[],
  deckName = 'Shifting Basalts deck',
): LoreDeckFile {
  const exportedCards = [...cards].sort(compareCardsForExport).map((card) => {
    const clean: LoreCard = {
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
    }
    if (card.adHoc === true) {
      clean.adHoc = true
    }
    return clean
  })

  return {
    schemaVersion: 1,
    deck: deckName,
    settings: {
      tierLimit: settings.tierLimit,
      deepPerRun: settings.deepPerRun,
      anchor: {
        name: settings.anchor.name,
        voiceNote: settings.anchor.voiceNote,
      },
    },
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      defaultImageUrl: group.defaultImageUrl,
      defaultImagePrompt: group.defaultImagePrompt,
    })),
    cards: exportedCards,
  }
}

/**
 * Build the player-safe deck summary with per-group counts excluding adHoc
 * cards and no card titles or text.
 */
export function buildSummary(groups: LoreGroup[], cards: LoreCard[]): LoreSummary {
  const counts = new Map<string, number>()
  for (const card of cards) {
    if (card.adHoc === true) continue
    counts.set(card.group, (counts.get(card.group) ?? 0) + 1)
  }

  const summaryGroups = groups.map((group) => ({
    id: group.id,
    name: group.name,
    count: counts.get(group.id) ?? 0,
  }))

  const total = summaryGroups.reduce((sum, group) => sum + group.count, 0)

  return {
    groups: summaryGroups,
    total,
  }
}
