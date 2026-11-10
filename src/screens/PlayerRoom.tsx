// Player screen: the current room as the party sees it (Player view
// visibility), plus Hidden Sight for owners. Built only from run.roomView,
// which never contains anything the DM hasn't shown.
import { useState } from 'react'
import type { RunPlayer, RunState } from '../model/run'
import {
  conditionOf,
  elevationOf,
  flavorText,
  lightingName,
  oddityText,
  shapeOf,
  sizeOf,
  terrainOf,
  trickNumbers,
  trickOf,
} from '../rules/rooms'
import { submitChoice, usePrivateHints } from '../runStore'
import { creatureOf } from '../rules/encounters'
import { bossOf, floorBossDc } from '../rules/bosses'
import { RoomCard } from './RoomCard'
import { Art } from './Art'
import { artUrl } from '../art'

const KIND_LABELS = { combat: 'Room', elite: 'Elite room', reprieve: 'Reprieve', boss: 'Boss room' }

interface Props {
  state: RunState
  /** The viewer's own character in this run, if any (for Hidden Sight). */
  me: RunPlayer | null
  readOnly?: boolean
}

export function PlayerRoom({ state, me, readOnly = false }: Props) {
  const { run } = state
  const view = run.roomView
  const hints = usePrivateHints(readOnly ? null : run.id, me?.characterId ?? null)
  const [sent, setSent] = useState(false)

  if (!view) return null
  const shape = shapeOf(view.shape)
  const numbers = trickNumbers(view.floor, run.partyLevel)
  const myHints = hints.filter((h) => h.floor === run.floor)
  const canUseSight =
    me?.alive && me.hiddenSight && me.hiddenSightFloor !== run.floor && view.kind !== 'boss' && view.kind !== 'reprieve'

  async function useSight() {
    if (!me || readOnly) return
    setSent(true)
    await submitChoice(run.id, me.characterId, { action: 'hiddenSight' }, null).catch(() => setSent(false))
  }

  return (
    <div className={`room-stage kind-${view.kind}`}>
      <h3>
        {KIND_LABELS[view.kind]} · floor {view.floor}
        {view.kind !== 'boss' && `, room ${view.room}`}
      </h3>
      <RoomCard
        shape={view.shape}
        size={view.size}
        lighting={view.lighting}
        exits={view.exits}
        trueExit={view.trueExit}
        terrain={view.terrain}
        tricks={view.tricks}
      />
      {view.bossId && (
        <>
          <Art kind="bosses" id={view.bossId} alt={bossOf(view.bossId).name} className="boss-portrait" />
          <p className="boss-name">
            <strong>{bossOf(view.bossId).name}</strong>
          </p>
        </>
      )}
      {(view.enemies?.length ?? 0) > 0 && (
        <>
          <p>
            <strong>Enemies:</strong>{' '}
            {view.enemies!.map((e) => `${e.count > 1 ? `${e.count} × ` : ''}${creatureOf(e.creatureId).name}`).join(', ')}
          </p>
          {/* Only revealed creatures are in view.enemies, so only their portraits show. */}
          {view.enemies!.some((e) => artUrl('creatures', e.creatureId)) && (
            <ul className="room-icons portraits">
              {view.enemies!.map((e, i) => (
                <li key={`${e.creatureId}-${i}`}>
                  <Art kind="creatures" id={e.creatureId} alt={creatureOf(e.creatureId).name} />
                  <span>
                    {e.count > 1 && `${e.count} × `}
                    {creatureOf(e.creatureId).name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {view.shifts?.map((id) => {
        const action = bossOf(id).shiftAction
        return (
          <p key={id} className="notice">
            Shift Action, <strong>{action.name}</strong>: {action.text.replace(/\{dc\}/g, String(floorBossDc(view.floor, run.partyLevel)))}
          </p>
        )
      })}
      <p>
        <strong>{shape.name}</strong>: {shape.description} {sizeOf(view.size).name} ({sizeOf(view.size).feet} ft
        across). {elevationOf(view.elevation).name}. {lightingName(view.lighting)}.
      </p>
      <p>
        {view.exits} doorway{view.exits === 1 ? '' : 's'}
        {view.exits > 1 && (view.trueExit ? `; #${view.trueExit} is the true exit.` : '; only one leads on.')}
      </p>
      <ul className="plain-list">
        {view.terrain.map((id) => (
          <li key={id}>
            <strong>{terrainOf(id).name}</strong>: {terrainOf(id).effect}
          </li>
        ))}
      </ul>
      <ul className="plain-list flavor">
        {flavorText(view).map((line) => (
          <li key={line}>{line}</li>
        ))}
        {view.oddity !== null && <li>{oddityText(view.oddity)}</li>}
      </ul>
      {view.tricks.length > 0 && (
        <div>
          <strong>Room tricks found</strong>
          <ul className="plain-list">
            {view.tricks.map((id) => (
              <li key={id}>
                <strong>{trickOf(id).name}</strong>: {trickOf(id).effect}{' '}
                <span className="hint">
                  (DC {numbers.dc}, {numbers.damage})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.condition !== null && (
        <p className="notice">Thils approves: {conditionOf(view.condition).condition}</p>
      )}

      {myHints.map((h) => (
        <p key={`${h.floor}-${h.room}`} className="private-hint">
          Hidden Sight (room {h.room}, only you see this): "{h.hint}"
        </p>
      ))}
      {canUseSight && (
        <button type="button" disabled={readOnly || sent} onClick={useSight}>
          {sent ? 'Asking the DM\'s app…' : 'Use Hidden Sight on this room (once per floor)'}
        </button>
      )}
    </div>
  )
}
