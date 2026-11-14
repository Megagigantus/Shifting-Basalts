// DM screen: the current room in full (the main stage), with a Reveal button
// for each part players can't see yet.
import { Crown, DoorOpen, Eye, Sparkles, TriangleExclamationPoint } from 'lucide-react'
import type { RunState } from '../model/run'
import { declineReprieve, enterRoom, rerollBoss, rerollRoom, reveal, startFloor } from '../rules/roomFlow'
import { bossOf } from '../rules/bosses'
import { DmFight } from './DmFight'
import { PostBossScene, ReprieveScene } from './Scene'
import { RoomCard } from './RoomCard'
import { DmBattleMap } from './DmBattleMap'
import { RevealControl } from './RevealControl'
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
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { PRIMARY_BUTTON, WELL } from '../ui/styles'
import { cx, type Tone } from '../ui/tone'

type Step = (s: RunState) => RunState

interface Props {
  state: RunState
  busy: boolean
  act: (step: Step, confirmText?: string) => void
}

const KIND_LABELS = { combat: 'Combat room', elite: 'Elite room', reprieve: 'Reprieve', boss: 'Boss room' }
const KIND_TONES: Record<keyof typeof KIND_LABELS, Tone> = { combat: 'stone', elite: 'amber', reprieve: 'emerald', boss: 'rose' }

export function DmRoom({ state, busy, act }: Props) {
  const { run } = state
  const room = state.dm?.room ?? null

  if (run.awaitingChoice) {
    return (
      <Panel>
        <PostBossScene state={state} forDm />
      </Panel>
    )
  }

  if (!room) {
    return (
      <Panel title="No room yet">
        <p className="m-0 text-xs text-stone-400">No room has been generated here yet.</p>
        <button
          type="button"
          disabled={busy}
          className={`${PRIMARY_BUTTON} self-start`}
          onClick={() => act((s) => (s.dm?.floorPlan?.length ? enterRoom(s, Math.random) : startFloor(s, Math.random)))}
        >
          Generate this room
        </button>
      </Panel>
    )
  }

  const shape = shapeOf(room.shape)
  const numbers = trickNumbers(room.floor, run.partyLevel)
  const falseWall = room.terrain.includes('false-wall')
  const hiddenIcons = new Set([
    ...(falseWall && !room.revealed.falseWall ? ['false-wall'] : []),
    ...room.tricks.filter((t) => !t.revealed).map((t) => t.id),
  ])
  const where = `Floor ${room.floor}${room.kind !== 'boss' ? ` · Room ${room.room}` : ''} · ${KIND_LABELS[room.kind]}`

  // Map first (what the table plays on), then the room in full, then the fight.
  return (
    <>
      <DmBattleMap state={state} room={room} busy={busy} act={act} />

      <Panel
        tone={KIND_TONES[room.kind]}
        title={`${KIND_LABELS[room.kind]} · floor ${room.floor}${room.kind !== 'boss' ? `, room ${room.room}` : ''}`}
        actions={
          <ConfirmButton tone="amber" disabled={busy} confirmLabel="Yes, reroll the room" onConfirm={() => act((s) => rerollRoom(s, Math.random))}>
            Reroll room
          </ConfirmButton>
        }
      >
        {room.kind === 'reprieve' ? (
          <ReprieveScene />
        ) : (
          <RoomCard
            eyebrow={where}
            shape={room.shape}
            size={room.size}
            lighting={room.lighting}
            exits={room.exits}
            trueExit={room.trueExit}
            terrain={room.terrain}
            tricks={room.tricks.map((t) => t.id)}
            hidden={hiddenIcons}
          />
        )}

        {room.kind === 'reprieve' && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            <span className="mr-auto">A safe room. Each player chooses Rest (a Short Rest without the hour) or Reflect (level up one boon).</span>
            <ConfirmButton
              tone="amber"
              disabled={busy}
              confirmLabel="Yes, fight instead"
              onConfirm={() => act((s) => declineReprieve(s, Math.random))}
            >
              Decline it and fight
            </ConfirmButton>
          </div>
        )}

        {state.dm?.bossId && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-stone-200">
            <Crown size={14} className="text-rose-300" />
            <span className="mr-auto">
              {room.kind === 'boss' ? "This floor's boss" : 'Waiting at the end of this floor'}:{' '}
              <strong className="text-rose-200">{bossOf(state.dm.bossId).name}</strong>{' '}
              <span className="text-stone-400">(DM only until its room starts)</span>
            </span>
            <ConfirmButton
              tone="amber"
              disabled={busy}
              confirmLabel="Yes, swap the boss"
              onConfirm={() => act((s) => rerollBoss(s, Math.random))}
            >
              Reroll boss
            </ConfirmButton>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          <Pill title={shape.description}>Shape: {shape.name}</Pill>
          <Pill>
            Size: {sizeOf(room.size).name} ({sizeOf(room.size).feet} ft)
          </Pill>
          <Pill>Elevation: {elevationOf(room.elevation).name}</Pill>
          <Pill tone="amber">Lighting: {lightingName(room.lighting)}</Pill>
          <Pill tone="sky" icon={<DoorOpen size={11} />}>
            {room.exits} doorway{room.exits === 1 ? '' : 's'}
          </Pill>
        </div>
        <p className="m-0 text-[11px] text-stone-400">{shape.description}</p>

        {room.exits > 1 && (
          <div className={cx(WELL, 'flex flex-wrap items-center gap-2 text-xs')}>
            <span className="mr-auto">
              True exit: <strong className="text-emerald-300">#{room.trueExit}</strong>{' '}
              <span className="text-stone-400">(Survival DC {trueExitDC(room.floor)})</span>
            </span>
            <RevealControl shown={room.revealed.trueExit} busy={busy} onReveal={() => act((s) => reveal(s, 'trueExit'))} />
          </div>
        )}

        <SectionLabel>Room details</SectionLabel>
        <ul className="m-0 list-none flex flex-col gap-1 p-0 text-xs text-stone-300">
          {flavorText(room).map((line) => (
            <li key={line}>• {line}</li>
          ))}
        </ul>

        <SectionLabel>Terrain</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {room.terrain.map((id) => {
            const hiddenWall = id === 'false-wall' && falseWall && !room.revealed.falseWall
            return (
              <div key={id} className={cx(WELL, 'flex flex-col gap-1', hiddenWall && 'border-rose-500/40 bg-rose-950/30')}>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <strong className="text-xs text-stone-100">{terrainOf(id).name}</strong>
                  {id === 'false-wall' && falseWall && (
                    <RevealControl shown={room.revealed.falseWall} busy={busy} onReveal={() => act((s) => reveal(s, 'falseWall'))} />
                  )}
                </div>
                <p className="m-0 text-[11px] text-stone-400">{terrainOf(id).effect}</p>
              </div>
            )
          })}
        </div>

        {room.oddity !== null && (
          <div className="flex flex-col gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <strong className="flex items-center gap-1.5 text-xs text-violet-200">
                <Sparkles size={13} /> Oddity
              </strong>
              <RevealControl shown={room.revealed.oddity} busy={busy} onReveal={() => act((s) => reveal(s, 'oddity'))} />
            </div>
            <p className="m-0 text-[11px] text-stone-300">{oddityText(room.oddity)}</p>
          </div>
        )}

        {room.tricks.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <SectionLabel>Tricks</SectionLabel>
              <Pill tone="rose" mono>
                DC {numbers.dc}
              </Pill>
              <Pill tone="rose" mono>
                {numbers.damage}
              </Pill>
            </div>
            <div className="flex flex-col gap-2">
              {room.tricks.map((t) => {
                const trick = trickOf(t.id)
                return (
                  <div key={t.id} className="flex flex-col gap-1 rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <strong className="flex items-center gap-1.5 text-xs text-rose-200">
                        <TriangleExclamationPoint size={13} /> {trick.name}
                        <span className="font-normal text-stone-500">floor {trick.floor} trick</span>
                      </strong>
                      <RevealControl
                        shown={t.revealed}
                        busy={busy}
                        label="Spring / reveal"
                        shownLabel="Sprung"
                        onReveal={() => act((s) => reveal(s, { trick: t.id }))}
                      />
                    </div>
                    <p className="m-0 text-[11px] text-stone-300">
                      <span className="text-stone-500">Trigger:</span> {trick.trigger}
                    </p>
                    <p className="m-0 text-[11px] text-stone-300">
                      <span className="text-stone-500">Effect:</span> {trick.effect}
                    </p>
                    <p className="m-0 text-[11px] text-stone-300">
                      <span className="text-stone-500">Counterplay:</span> {trick.counterplay}
                    </p>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {room.condition !== null && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-rose-500/30 bg-stone-950/70 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <strong className="flex items-center gap-1.5 text-xs text-rose-300">
                <Eye size={13} /> DM secret condition
              </strong>
              {room.revealed.condition ? (
                <Pill tone="emerald">Met and shown</Pill>
              ) : (
                <ConfirmButton
                  tone="emerald"
                  disabled={busy}
                  confirmLabel="Yes, condition met"
                  onConfirm={() => act((s) => reveal(roomConditionMet(s, Math.random), 'condition'))}
                >
                  Condition met
                </ConfirmButton>
              )}
            </div>
            <p className="m-0 text-xs text-stone-200">{conditionOf(room.condition).condition}</p>
            <p className="m-0 text-[11px] text-stone-500">Hidden Sight hint: "{conditionOf(room.condition).hint}"</p>
            {!room.revealed.condition && (
              <p className="m-0 text-[10px] text-stone-500">When met, players see it and every living player gets a hidden offer of 2 gifts.</p>
            )}
          </div>
        )}
      </Panel>

      <DmFight state={state} room={room} busy={busy} act={act} />
    </>
  )
}
