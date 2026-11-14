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
import { submitChoice, useChoices, usePrivateHints } from '../runStore'
import { ReprieveChoices } from './ReprieveChoices'
import { creatureOf } from '../rules/encounters'
import { bossOf, floorBossDc } from '../rules/bosses'
import { RoomCard } from './RoomCard'
import { PlayerBattleMap } from './PlayerBattleMap'
import { PhaseReveal } from './PhaseReveal'
import { ReprieveScene } from './Scene'
import { artUrl, phase2ArtId } from '../art'
import { Eye } from 'lucide-react'
import { useLightbox } from '../ui/lightboxContext'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { QUIET_BUTTON, WELL } from '../ui/styles'
import { cx, initials } from '../ui/tone'

/** "Bloodied" for one creature, "2 Bloodied" for some of a group, "all Bloodied" for the whole group. */
const bloodiedLabel = (count: number, bloodied: number) =>
  count === 1 ? 'Bloodied' : bloodied >= count ? 'all Bloodied' : `${bloodied} Bloodied`

const KIND_LABELS = { combat: 'Room', elite: 'Elite room', reprieve: 'Reprieve', boss: 'Boss room' }

interface Props {
  state: RunState
  /** The viewer's own character in this run, if any (for Hidden Sight). */
  me: RunPlayer | null
  readOnly?: boolean
  /** Every character the viewer owns in this run (they can move all of their tokens). */
  myCharacterIds?: string[]
}

export function PlayerRoom({ state, me, readOnly = false, myCharacterIds }: Props) {
  const { run } = state
  const view = run.roomView
  const hints = usePrivateHints(readOnly ? null : run.id, me?.characterId ?? null)
  const [sent, setSent] = useState(false)
  const showArt = useLightbox()
  const choices = useChoices(run.id)

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

  const bossArt = view.bossId
    ? (view.bossBloodied ? artUrl('bosses', phase2ArtId(view.bossId)) : null) ?? artUrl('bosses', view.bossId)
    : null

  return (
    <>
      <PlayerBattleMap state={state} myIds={myCharacterIds ?? (me ? [me.characterId] : [])} readOnly={readOnly} />
      {view.bossId && !readOnly && <PhaseReveal runId={run.id} bossId={view.bossId} bloodied={Boolean(view.bossBloodied)} />}

      <Panel
        tone={view.kind === 'boss' ? 'rose' : view.kind === 'elite' ? 'amber' : view.kind === 'reprieve' ? 'emerald' : 'stone'}
        title={`${KIND_LABELS[view.kind]} · floor ${view.floor}${view.kind !== 'boss' ? `, room ${view.room}` : ''}`}
      >
        {view.kind === 'reprieve' ? (
          <>
            <ReprieveScene />
            <ReprieveChoices
              state={state}
              players={state.players.filter((p) => (myCharacterIds ?? (me ? [me.characterId] : [])).includes(p.characterId))}
              busy={readOnly}
              pending={new Set(Object.entries(choices).filter(([, c]) => !c.error && c.action.startsWith('reprieve')).map(([id]) => id))}
              onChoose={(characterId, choice) => {
                if (!readOnly) submitChoice(run.id, characterId, choice, null).catch((e) => console.error('Could not send your Reprieve choice', e))
              }}
            />
            {Object.values(choices).some((c) => c.error && c.action.startsWith('reprieve')) && (
              <p className="m-0 text-xs text-rose-300">Your Reprieve choice didn't go through. Please choose again.</p>
            )}
          </>
        ) : (
          <RoomCard
            eyebrow={`Floor ${view.floor}${view.kind !== 'boss' ? ` · Room ${view.room}` : ''} · ${KIND_LABELS[view.kind]}`}
            shape={view.shape}
            size={view.size}
            lighting={view.lighting}
            exits={view.exits}
            trueExit={view.trueExit}
            terrain={view.terrain}
            tricks={view.tricks}
          />
        )}

        {view.bossId && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-950/20 p-3">
            {bossArt && (
              <button
                type="button"
                onClick={() => showArt({ src: bossArt, title: bossOf(view.bossId!).name })}
                aria-label={`Enlarge ${bossOf(view.bossId).name}`}
                className="box-border h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-rose-500/40 bg-stone-950 p-0"
              >
                <img src={bossArt} alt="" className="h-full w-full object-cover" />
              </button>
            )}
            <div className="flex flex-col gap-1">
              <strong className="text-base text-rose-100">{bossOf(view.bossId).name}</strong>
              {view.bossBloodied ? <Pill tone="rose" className="self-start">Bloodied</Pill> : <Pill className="self-start">Healthy</Pill>}
            </div>
          </div>
        )}

        {(view.enemies?.length ?? 0) > 0 && (
          <>
            <SectionLabel>Enemies</SectionLabel>
            {/* Only revealed creatures are in view.enemies. */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {view.enemies!.map((e, i) => {
                const url = artUrl('creatures', e.creatureId)
                const name = creatureOf(e.creatureId).name
                return (
                  <div key={`${e.creatureId}-${i}`} className={cx(WELL, 'flex items-center gap-2.5')}>
                    {url ? (
                      <button
                        type="button"
                        onClick={() => showArt({ src: url, title: name })}
                        aria-label={`Enlarge ${name}`}
                        className="box-border h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-stone-700 bg-stone-950 p-0"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs text-stone-400">
                        {initials(name)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 text-xs font-semibold text-stone-100">
                      {e.count > 1 && `${e.count} × `}
                      {name}
                    </span>
                    {(e.bloodied ?? 0) > 0 && <Pill tone="rose">{bloodiedLabel(e.count, e.bloodied!)}</Pill>}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {view.shifts?.map((id) => {
          const action = bossOf(id).shiftAction
          return (
            <p key={id} className="m-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <strong>Shift Action: {action.name}.</strong> {action.text.replace(/\{dc\}/g, String(floorBossDc(view.floor, run.partyLevel)))}
            </p>
          )
        })}

        <div className="flex flex-wrap gap-1.5">
          <Pill title={shape.description}>{shape.name}</Pill>
          <Pill>
            {sizeOf(view.size).name} ({sizeOf(view.size).feet} ft)
          </Pill>
          <Pill>{elevationOf(view.elevation).name}</Pill>
          <Pill tone="amber">{lightingName(view.lighting)}</Pill>
          <Pill tone="sky">
            {view.exits} doorway{view.exits === 1 ? '' : 's'}
            {view.exits > 1 && (view.trueExit ? ` · #${view.trueExit} is the true exit` : ' · only one leads on')}
          </Pill>
        </div>
        <p className="m-0 text-[0.6875rem] text-stone-400">{shape.description}</p>

        <SectionLabel>Room details</SectionLabel>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-stone-300">
          {flavorText(view).map((line) => (
            <li key={line}>• {line}</li>
          ))}
          {view.oddity !== null && <li className="text-violet-200">• {oddityText(view.oddity)}</li>}
        </ul>

        <SectionLabel>Terrain</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {view.terrain.map((id) => (
            <div key={id} className={cx(WELL, 'flex flex-col gap-1')}>
              <strong className="text-xs text-stone-100">{terrainOf(id).name}</strong>
              <p className="m-0 text-[0.6875rem] text-stone-400">{terrainOf(id).effect}</p>
            </div>
          ))}
        </div>

        {view.tricks.length > 0 && (
          <>
            <SectionLabel>Room tricks found</SectionLabel>
            {view.tricks.map((id) => (
              <div key={id} className="flex flex-col gap-1 rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <strong className="text-xs text-rose-200">{trickOf(id).name}</strong>
                  <Pill tone="rose" mono>
                    DC {numbers.dc}
                  </Pill>
                  <Pill tone="rose" mono>
                    {numbers.damage}
                  </Pill>
                </div>
                <p className="m-0 text-[0.6875rem] text-stone-300">{trickOf(id).effect}</p>
              </div>
            ))}
          </>
        )}

        {view.condition !== null && (
          <p className="m-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            <strong>Thils approves:</strong> {conditionOf(view.condition).condition}
          </p>
        )}

        {myHints.map((h) => (
          <p key={`${h.floor}-${h.room}`} className="m-0 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
            <strong>Hidden Sight</strong> (room {h.room}, only you see this): "{h.hint}"
          </p>
        ))}
        {canUseSight && (
          <button type="button" disabled={readOnly || sent} onClick={useSight} className={cx(QUIET_BUTTON, 'self-start text-violet-200')}>
            <Eye size={13} /> {sent ? "Asking the DM's app…" : 'Use Hidden Sight on this room (once per floor)'}
          </button>
        )}
      </Panel>
    </>
  )
}
