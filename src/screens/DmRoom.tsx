// DM screen: the current room in full (the main stage), with a Reveal button
// for each part players can't see yet.
import type { RunState } from '../model/run'
import { declineReprieve, enterRoom, rerollBoss, rerollRoom, reveal, startFloor } from '../rules/roomFlow'
import { bossOf } from '../rules/bosses'
import { DmFight } from './DmFight'
import { HealingFontNote } from './HealingFontNote'
import { RoomCard } from './RoomCard'
import { DmBattleMap } from './DmBattleMap'
import { roomConditionMet } from '../rules/draftFlow'
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
  trueExitDC,
} from '../rules/rooms'

type Step = (s: RunState) => RunState

interface Props {
  state: RunState
  busy: boolean
  act: (step: Step, confirmText?: string) => void
}

const KIND_LABELS = { combat: 'Combat room', elite: 'Elite room', reprieve: 'Reprieve', boss: 'Boss room' }

function Hidden({ shown, onReveal, busy }: { shown: boolean; onReveal: () => void; busy: boolean }) {
  return shown ? (
    <span className="tag shown">shown to players</span>
  ) : (
    <>
      <span className="tag hidden-tag">hidden</span>
      <button type="button" className="quiet" disabled={busy} onClick={onReveal}>
        Reveal
      </button>
    </>
  )
}

export function DmRoom({ state, busy, act }: Props) {
  const { run } = state
  const room = state.dm?.room ?? null

  if (run.awaitingChoice) {
    return (
      <div className="room-stage">
        <h3>Post-boss room</h3>
        <HealingFontNote state={state} />
        <p className="hint">Use any Forge or Healing Font here, then descend or extract.</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="room-stage">
        <p className="hint">No room has been generated here yet.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => act((s) => (s.dm?.floorPlan?.length ? enterRoom(s, Math.random) : startFloor(s, Math.random)))}
        >
          Generate this room
        </button>
      </div>
    )
  }

  const shape = shapeOf(room.shape)
  const numbers = trickNumbers(room.floor, run.partyLevel)
  const falseWall = room.terrain.includes('false-wall')
  const hiddenIcons = new Set([
    ...(falseWall && !room.revealed.falseWall ? ['false-wall'] : []),
    ...room.tricks.filter((t) => !t.revealed).map((t) => t.id),
  ])

  return (
    <div className={`room-stage kind-${room.kind}`}>
      <div className="panel-header">
        <h3>
          {KIND_LABELS[room.kind]} · floor {room.floor}
          {room.kind !== 'boss' && `, room ${room.room}`}
        </h3>
        <button
          type="button"
          className="quiet"
          disabled={busy}
          onClick={() => act((s) => rerollRoom(s, Math.random), 'Roll this room again from scratch?')}
        >
          Reroll room
        </button>
      </div>

      <RoomCard
        shape={room.shape}
        size={room.size}
        lighting={room.lighting}
        exits={room.exits}
        trueExit={room.trueExit}
        terrain={room.terrain}
        tricks={room.tricks.map((t) => t.id)}
        hidden={hiddenIcons}
      />

      <DmBattleMap state={state} room={room} busy={busy} act={act} />

      {state.dm?.bossId && (
        <p className="hint">
          {room.kind === 'boss' ? 'This floor\'s boss' : 'Waiting at the end of this floor'}:{' '}
          <strong>{bossOf(state.dm.bossId).name}</strong> (DM only until its room starts){' '}
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={() => act((s) => rerollBoss(s, Math.random), 'Swap this floor\'s boss for another of its three?')}
          >
            Reroll boss
          </button>
        </p>
      )}

      {room.kind === 'reprieve' && (
        <p className="notice">
          A safe room. Each player chooses Rest (a Short Rest without the hour) or Reflect (level up one boon).{' '}
          <button
            type="button"
            className="link"
            disabled={busy}
            onClick={() => act((s) => declineReprieve(s, Math.random), 'Decline the Reprieve and fight this room instead?')}
          >
            Decline it and fight instead
          </button>
        </p>
      )}

      <dl className="room-facts">
        <dt>Shape</dt>
        <dd>
          <strong>{shape.name}</strong>: {shape.description}
        </dd>
        <dt>Size</dt>
        <dd>
          {sizeOf(room.size).name} ({sizeOf(room.size).feet} ft across)
        </dd>
        <dt>Elevation</dt>
        <dd>{elevationOf(room.elevation).name}</dd>
        <dt>Lighting</dt>
        <dd>{lightingName(room.lighting)}</dd>
        <dt>Exits</dt>
        <dd>
          {room.exits} doorway{room.exits === 1 ? '' : 's'}.{' '}
          {room.exits > 1 && (
            <>
              True exit: <strong>#{room.trueExit}</strong> (Survival DC {trueExitDC(room.floor)}){' '}
              <Hidden shown={room.revealed.trueExit} busy={busy} onReveal={() => act((s) => reveal(s, 'trueExit'))} />
            </>
          )}
        </dd>
        <dt>Terrain</dt>
        <dd>
          <ul className="plain-list">
            {room.terrain.map((id) => (
              <li key={id}>
                <strong>{terrainOf(id).name}</strong>: {terrainOf(id).effect}{' '}
                {id === 'false-wall' && falseWall && (
                  <Hidden shown={room.revealed.falseWall} busy={busy} onReveal={() => act((s) => reveal(s, 'falseWall'))} />
                )}
              </li>
            ))}
          </ul>
        </dd>
        <dt>Flavor</dt>
        <dd>
          <ul className="plain-list">
            {flavorText(room).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </dd>
        {room.oddity !== null && (
          <>
            <dt>Oddity</dt>
            <dd>
              {oddityText(room.oddity)}{' '}
              <Hidden shown={room.revealed.oddity} busy={busy} onReveal={() => act((s) => reveal(s, 'oddity'))} />
            </dd>
          </>
        )}
        {room.tricks.length > 0 && (
          <>
            <dt>Tricks</dt>
            <dd>
              <span className="hint">
                DC {numbers.dc} · damage {numbers.damage} on this floor
              </span>
              <ul className="plain-list">
                {room.tricks.map((t) => {
                  const trick = trickOf(t.id)
                  return (
                    <li key={t.id}>
                      <strong>{trick.name}</strong> (floor {trick.floor} trick){' '}
                      <Hidden
                        shown={t.revealed}
                        busy={busy}
                        onReveal={() => act((s) => reveal(s, { trick: t.id }))}
                      />
                      <div className="hint">Trigger: {trick.trigger}</div>
                      <div className="hint">Effect: {trick.effect}</div>
                      <div className="hint">Counterplay: {trick.counterplay}</div>
                    </li>
                  )
                })}
              </ul>
            </dd>
          </>
        )}
        {room.condition !== null && (
          <>
            <dt>Secret condition</dt>
            <dd>
              {conditionOf(room.condition).condition}{' '}
              <span className="hint">(Hidden Sight hint: "{conditionOf(room.condition).hint}")</span>{' '}
              {room.revealed.condition ? (
                <span className="tag shown">met and shown</span>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(
                      (s) => reveal(roomConditionMet(s, Math.random), 'condition'),
                      'Mark the secret condition as met? Players see it, and every living player gets a hidden offer of 2 gifts.',
                    )
                  }
                >
                  Condition met
                </button>
              )}
            </dd>
          </>
        )}
      </dl>

      <DmFight state={state} room={room} busy={busy} act={act} />
    </div>
  )
}
