// Pure derivation of lore events and pause points from a run state transition.
// Browser-safe: no Firebase, React, or Node imports.
import type { RunPlayer, RunState } from '../model/run'
import { hiddenBoon, type SlotContent } from '../rules/boons'
import { SHRINE_TERRAIN } from '../rules/loot'
import type { LoreEvent } from './triggers'

function eventKey(event: LoreEvent): string {
  return event.arg === undefined ? event.type : `${event.type}\0${event.arg}`
}

function anyPlayerDied(previous: RunState | null, next: RunState): boolean {
  if (!previous) return false
  const prevById = new Map(previous.players.map((p) => [p.characterId, p]))
  return next.players.some((p) => {
    const prev = prevById.get(p.characterId)
    return prev?.alive === true && !p.alive
  })
}

function addPlayerEvents(
  prevById: Map<string, RunPlayer>,
  next: RunState,
  emit: (event: LoreEvent) => void,
) {
  for (const player of next.players) {
    const prev = prevById.get(player.characterId)
    if (!prev) continue

    const prevBoons = new Set(
      (prev.slots ?? [])
        .filter((s): s is Extract<SlotContent, { kind: 'boon' }> => s?.kind === 'boon')
        .map((s) => s.boonId),
    )
    for (const slot of player.slots ?? []) {
      if (slot?.kind === 'boon' && !prevBoons.has(slot.boonId)) {
        emit({ type: 'boon_first_draft', arg: slot.boonId })
      }
    }

    const nextHidden = player.hiddenBoonId ?? null
    const prevHidden = prev.hiddenBoonId ?? null
    if (nextHidden && nextHidden !== prevHidden) {
      emit({ type: 'hidden_boon_first', arg: nextHidden })
      try {
        if (hiddenBoon(nextHidden).kind === 'gift') {
          emit({ type: 'hidden_gift_first' })
        }
      } catch {
        // Unknown hidden boon id: skip the gift check.
      }
    }

    const prevQb = prev.quantumBasaltsEarned + prev.quantumBasaltsPassed
    const nextQb = player.quantumBasaltsEarned + player.quantumBasaltsPassed
    if (nextQb > prevQb) {
      emit({ type: 'first_qb' })
    }

    if (prev.alive && !player.alive) {
      emit({ type: 'first_death' })
    }
  }
}

function addRoomEvents(
  previous: RunState | null,
  next: RunState,
  emit: (event: LoreEvent) => void,
) {
  const nextBossRoom = next.dm?.room
  const bossId = nextBossRoom?.boss?.id
  if (bossId) {
    const prevBossRoom = previous?.dm?.room
    const sameBossRoom =
      prevBossRoom != null &&
      prevBossRoom.boss?.id === bossId &&
      prevBossRoom.floor === nextBossRoom.floor &&
      prevBossRoom.room === nextBossRoom.room
    if (!sameBossRoom) {
      emit({ type: 'boss_first_meet', arg: bossId, immediate: true })
    }
  }

  const prevView = previous?.run.roomView ?? null
  const nextView = next.run.roomView ?? null
  if (!nextView) return

  const sameView =
    prevView !== null && prevView.floor === nextView.floor && prevView.room === nextView.room

  if (sameView) {
    if (prevView.oddity == null && typeof nextView.oddity === 'number') {
      emit({ type: 'oddity', arg: String(nextView.oddity + 1) })
    }
    if (prevView.condition == null && typeof nextView.condition === 'number') {
      emit({ type: 'thils_touch' })
    }
    if (nextView.tricks.length > prevView.tricks.length) {
      emit({ type: 'thils_touch' })
    }
  }

  if (nextView.terrain.includes(SHRINE_TERRAIN)) {
    const prevHadShrine = sameView && prevView.terrain.includes(SHRINE_TERRAIN)
    if (!prevHadShrine) {
      emit({ type: 'shrine_first' })
      emit({ type: 'thils_touch' })
    }
  }
}

function derivePauseRoomKey(previous: RunState | null, next: RunState): string | null {
  if (!previous) return null
  if (next.run.log.length > previous.run.log.length) {
    const last = next.run.log[next.run.log.length - 1]
    return `${last.floor}-${last.room}`
  }

  const prevById = new Map(previous.players.map((p) => [p.characterId, p]))
  const draftResolved = next.players.some((p) => {
    const prev = prevById.get(p.characterId)
    return prev != null && prev.draft != null && (p.draft ?? null) === null
  })
  if (!draftResolved) return null

  const last = next.run.log[next.run.log.length - 1]
  return last ? `${last.floor}-${last.room}` : 'start'
}

/**
 * Compare a run's state before and after a save and return the lore events
 * that happened plus the pause room key (if this save is a lore pause).
 */
export function deriveLoreEvents(
  previous: RunState | null,
  next: RunState,
): { events: LoreEvent[]; pauseRoomKey: string | null } {
  if (next.run.status !== 'active') {
    return {
      events: anyPlayerDied(previous, next) ? [{ type: 'first_death' }] : [],
      pauseRoomKey: null,
    }
  }

  const events: LoreEvent[] = []
  const seen = new Set<string>()
  const emit = (event: LoreEvent) => {
    const key = eventKey(event)
    if (seen.has(key)) return
    seen.add(key)
    events.push(event)
  }

  if (previous === null) {
    emit({ type: 'first_entry' })
    emit({ type: 'pressures_chosen', values: { count: next.run.pressures.length } })
    emit({ type: 'floor_first_arrival', arg: String(next.run.floor) })
  } else {
    if (next.run.floor > previous.run.floor) {
      emit({ type: 'floor_first_arrival', arg: String(next.run.floor) })
    }
    const prevById = new Map(previous.players.map((p) => [p.characterId, p]))
    addPlayerEvents(prevById, next, emit)
  }

  const prevLootCount = previous?.run.loot?.items.length ?? 0
  const nextLootCount = next.run.loot?.items.length ?? 0
  if (nextLootCount > prevLootCount) {
    emit({ type: 'loot_reveal', values: { floor: next.run.floor } })
  }

  addRoomEvents(previous, next, emit)

  if (next.run.vaultOpen === true && previous?.run.vaultOpen !== true) {
    emit({ type: 'thils_touch' })
  }

  return {
    events,
    pauseRoomKey: derivePauseRoomKey(previous, next),
  }
}
