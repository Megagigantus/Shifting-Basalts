import soundCuesData from '../data/sound-cues.json'
import type { RunPlayer, RunState } from '../model/run'
import type { SlotContent } from '../rules/boons'
import type { RoomView } from '../rules/rooms'
import type { MomentViewer } from './types'

/** Which screens play a sound cue. */
export type CueScreens = 'table' | 'tableAndOwn' | 'own'

/** A sound cue triggered by a run state change (`characterId: null` means shared). */
export interface CueEvent {
  key: string
  characterId: string | null
}

/** Map of sound cue key to its target screens, loaded from data config. */
export const SOUND_CUES: Record<string, CueScreens> = soundCuesData.cues as Record<string, CueScreens>

const ALLOWED_SCREENS = new Set<string>(['table', 'tableAndOwn', 'own'])

type EmitCue = (key: string, characterId: string | null) => void

function roomCues(
  prevRoom: RoomView | null | undefined,
  nextRoom: RoomView | null | undefined,
  emit: EmitCue,
): void {
  if (!nextRoom) return

  if (!prevRoom || prevRoom.floor !== nextRoom.floor || prevRoom.room !== nextRoom.room) {
    emit(nextRoom.kind === 'boss' ? 'bossReveal' : 'roomOpen', null)
    return
  }

  if ((nextRoom.shifts ?? []).length > (prevRoom.shifts ?? []).length) {
    emit('shift', null)
  }

  const prevTricks = new Set(prevRoom.tricks ?? [])
  const newTrick = (nextRoom.tricks ?? []).some((id) => !prevTricks.has(id))
  const conditionRevealed = prevRoom.condition == null && typeof nextRoom.condition === 'number'
  if (newTrick || conditionRevealed) {
    emit('trap', null)
  }
}

function lootCues(prevRun: RunState['run'], nextRun: RunState['run'], emit: EmitCue): void {
  const prevCount = prevRun.loot?.items?.length ?? 0
  const nextCount = nextRun.loot?.items?.length ?? 0
  if (nextCount > prevCount) {
    emit('loot', null)
  }

  const prevPickKeys = new Set(
    (prevRun.lootShare?.picks ?? []).map((p) => JSON.stringify([p.uid, p.characterId])),
  )
  for (const pick of nextRun.lootShare?.picks ?? []) {
    if (!prevPickKeys.has(JSON.stringify([pick.uid, pick.characterId]))) {
      emit('loot', pick.characterId)
    }
  }
}

function slotCues(prevPlayers: RunPlayer[], nextPlayers: RunPlayer[], emit: EmitCue): void {
  const prevById = new Map(prevPlayers.map((p) => [p.characterId, p]))

  for (const player of nextPlayers) {
    const prevPlayer = prevById.get(player.characterId)
    if (!prevPlayer) continue

    const prevSlots = prevPlayer.slots ?? []
    const prevCombinations = new Set(
      prevSlots
        .filter((s): s is Extract<SlotContent, { kind: 'combination' }> => s?.kind === 'combination')
        .map((s) => s.combinationId),
    )
    const prevEvolutions = new Set(
      prevSlots
        .filter((s): s is Extract<SlotContent, { kind: 'evolution' }> => s?.kind === 'evolution')
        .map((s) => s.evolutionId),
    )

    for (const slot of player.slots ?? []) {
      if (slot?.kind === 'combination' && !prevCombinations.has(slot.combinationId)) {
        emit('fusionDone', player.characterId)
      } else if (slot?.kind === 'evolution' && !prevEvolutions.has(slot.evolutionId)) {
        emit('evolutionDone', player.characterId)
      }
    }
  }
}

/**
 * Compare two player-safe run snapshots and return deduplicated sound cue events.
 * Never reads `state.dm` or mutates its inputs.
 */
export function cuesFromChange(prev: RunState | null, next: RunState): CueEvent[] {
  if (!prev || prev.run.id !== next.run.id) return []

  const events: CueEvent[] = []
  const seen = new Set<string>()
  const emit: EmitCue = (key, characterId) => {
    const dedupKey = JSON.stringify([key, characterId])
    if (seen.has(dedupKey)) return
    seen.add(dedupKey)
    events.push({ key, characterId })
  }

  roomCues(prev.run.roomView, next.run.roomView, emit)
  lootCues(prev.run, next.run, emit)
  slotCues(prev.players, next.players, emit)

  return events
}

/** Return true when a sound cue event should play on the given viewer screen. */
export function cuePlaysOn(
  event: CueEvent,
  viewer: MomentViewer,
  cues: Record<string, CueScreens> = SOUND_CUES,
): boolean {
  if (!Object.hasOwn(cues, event.key)) return false
  const screens = cues[event.key]
  if (screens === 'own') return false
  if (viewer.kind === 'dm') return false
  if (viewer.kind === 'table') return screens === 'table' || screens === 'tableAndOwn'
  return (
    screens === 'tableAndOwn' &&
    event.characterId !== null &&
    viewer.characterIds.includes(event.characterId)
  )
}

/** Validate sound cue routing config against available theme sounds, returning human-readable problems. */
export function checkSoundCues(
  cues: Record<string, string>,
  sounds: Record<string, string>,
): string[] {
  const problems: string[] = []
  for (const [key, screens] of Object.entries(cues)) {
    if (!Object.hasOwn(sounds, key)) {
      problems.push(`Sound cue "${key}" is missing from sounds`)
    }
    if (!ALLOWED_SCREENS.has(screens)) {
      problems.push(`Sound cue "${key}" has invalid screens "${screens}"`)
    }
  }
  return problems
}
