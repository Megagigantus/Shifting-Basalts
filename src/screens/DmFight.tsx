// DM screen: the fight in the current room. An encounter's creatures (with
// roster CR, reskin source, twist and echo boons) or a boss's full stat block
// built from the benchmarks. Players never receive any of this.
import type { ReactNode } from 'react'
import { Crown, Skull, Swords, Zap } from 'lucide-react'
import type { RunState } from '../model/run'
import type { Room } from '../rules/rooms'
import { crLabel, creatureOf, creatureStats, creatureXp, familyOf, pushedStats, type Encounter } from '../rules/encounters'
import { bossBloodied, hpTrackers, type Tracker } from '../rules/hp'
import { BloodiedControl, HpList, StatLine } from './HpTracker'
import { bossOf, buildBoss, floorBossDc, type AbilityProfile, type BossStats } from '../rules/bosses'
import { ABILITIES, type Ability } from '../rules/encounters'
import { boon } from '../rules/boons'
import { changeHp, rerollEncounter, reveal, setBossBloodied } from '../rules/roomFlow'
import { artUrl, partArtId, phase2ArtId, type ArtKind } from '../art'
import { RevealControl } from './RevealControl'
import { ConfirmButton } from '../ui/ConfirmButton'
import { useLightbox } from '../ui/lightboxContext'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { PRIMARY_BUTTON, SMALL_BUTTON, WELL } from '../ui/styles'
import { cx, initials } from '../ui/tone'

type Step = (s: RunState) => RunState
type Act = (step: Step, confirmText?: string) => void

/** A round (or rounded-square) portrait that enlarges on click, or initials when there's no art. */
function Portrait({ kind, id, name, size = 'h-12 w-12', square }: { kind: ArtKind; id: string; name: string; size?: string; square?: boolean }) {
  const showArt = useLightbox()
  const url = artUrl(kind, id)
  const shape = square ? 'rounded-lg' : 'rounded-full'
  if (!url) {
    return (
      <span className={cx(size, shape, 'flex shrink-0 items-center justify-center border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-stone-400')}>
        {initials(name)}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={() => showArt({ src: url, title: name })}
      aria-label={`Enlarge ${name}`}
      className={cx(size, shape, 'box-border shrink-0 cursor-pointer overflow-hidden border border-stone-700 bg-stone-950 p-0')}
    >
      <img src={url} alt="" className="h-full w-full object-cover" />
    </button>
  )
}

export function EncounterPanel({
  encounter,
  trackers = [],
  busy,
  act,
}: {
  encounter: Encounter
  /** HP rows for this room's creatures (from hpTrackers). */
  trackers?: Tracker[]
  busy: boolean
  act: Act
}) {
  const family = familyOf(encounter.family)
  const families = [family, ...(encounter.splashFamily ? [familyOf(encounter.splashFamily)] : [])]
  const total = encounter.groups.reduce((s, g) => s + creatureXp(g.cr) * g.count, 0)
  const allShown = encounter.groups.every((g) => g.revealed)
  return (
    <Panel
      tone="rose"
      icon={<Swords size={15} />}
      title={`DM encounter: ${family.name}${encounter.splashFamily ? ` + ${familyOf(encounter.splashFamily).name}` : ''}`}
      subtitle={
        <>
          Budget {encounter.budget.toLocaleString()} XP · used {encounter.xp.toLocaleString()} XP
          {encounter.elite &&
            ` · elite extra (${encounter.elite === 'push' ? 'one creature +2 CR' : "a next floor's creature"}): ${total.toLocaleString()} XP in all`}{' '}
          · CR cap {encounter.maxCr}
        </>
      }
      actions={
        <>
          {!allShown && (
            <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => act((s) => reveal(s, 'enemies'))}>
              Reveal all
            </button>
          )}
          <ConfirmButton tone="amber" disabled={busy} confirmLabel="Yes, reroll" onConfirm={() => act((s) => rerollEncounter(s, Math.random))}>
            Reroll encounter
          </ConfirmButton>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {encounter.groups.map((g, i) => {
          const c = creatureOf(g.creatureId)
          const pushed = pushedStats(g)
          return (
            <div key={`${g.creatureId}-${g.cr}-${i}`} className={cx(WELL, 'flex flex-col gap-2', !g.revealed && 'border-dashed')}>
              <div className="flex items-start gap-3">
                <Portrait kind="creatures" id={g.creatureId} name={c.name} />
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-sm text-stone-100">
                      {g.count} × {c.name}
                    </strong>
                    <Pill tone="amber" mono>
                      CR {crLabel(g.cr)}
                    </Pill>
                    <Pill>{c.role}</Pill>
                    {g.source === 'splash' && <Pill tone="violet">Splash</Pill>}
                    {g.source === 'elite' && <Pill tone="amber">Elite extra</Pill>}
                  </div>
                  <div className="text-[11px] text-stone-400">Reskin of {c.reskin}</div>
                </div>
                <RevealControl shown={g.revealed} busy={busy} onReveal={() => act((s) => reveal(s, { enemy: i }))} />
              </div>
              {pushed && (
                <p className="m-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
                  Pushed from CR {crLabel(c.cr)}: use AC {pushed.ac}, HP {pushed.hp}, +{pushed.attack} to hit, about {pushed.dpr} damage per
                  round, save DC {pushed.dc}. The saves below include the higher PB.
                </p>
              )}
              {g.boons?.map((b, j) => {
                const data = boon(b.id)
                return (
                  <p key={j} className="m-0 rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-100">
                    Echo {g.count > 1 ? j + 1 : ''} carries <strong>{data.name}</strong> (Level {b.level}): {data.levels.slice(0, b.level).join(' ')}
                  </p>
                )
              })}
              <StatLine {...creatureStats(g)} />
              <HpList trackers={trackers.filter((t) => t.group === i)} busy={busy} onChange={(key, amount) => act((s) => changeHp(s, key, amount))} />
            </div>
          )
        })}
      </div>
      {families.map((f) => (
        <div key={f.id} className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-stone-950/60 p-2">
          <Portrait kind="families" id={f.id} name={f.name} size="h-9 w-9" square />
          <p className="m-0 text-[11px] text-stone-300">
            <strong className="text-amber-200">{f.name} twist:</strong> {f.twist}
          </p>
        </div>
      ))}
    </Panel>
  )
}

const attackLine = (a: BossStats['attacks'][number], boss: BossStats) =>
  a.kind === 'save'
    ? `DC ${boss.dc} ${a.save} save, ${a.damage.average} (${a.damage.expression}) ${a.type} damage`
    : `+${boss.attack} to hit (${a.kind}), ${a.damage.average} (${a.damage.expression}) ${a.type} damage`

/** HP tracking for a boss block (DM's live fight only). */
interface BossHp {
  trackers: Tracker[]
  bloodied: boolean
  override: boolean | null
  onChange: (key: string, amount: number) => void
  onSetBloodied: (value: boolean | null) => void
}

const scoresOf = (p: AbilityProfile) => Object.fromEntries(ABILITIES.map((a) => [a, p[a].score])) as Record<Ability, number>
const savesOf = (p: AbilityProfile) => Object.fromEntries(ABILITIES.map((a) => [a, p[a].save])) as Record<Ability, number>

/** One labelled block inside the boss card. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <div className="text-xs text-stone-300">{children}</div>
    </div>
  )
}

export function BossBlock({
  boss,
  revealed,
  busy,
  onTrigger,
  hp,
}: {
  boss: BossStats
  revealed: boolean
  busy: boolean
  onTrigger?: () => void
  hp?: BossHp
}) {
  const showArt = useLightbox()
  const mainArt = artUrl('bosses', boss.bossId)
  const phase2Art = artUrl('bosses', phase2ArtId(boss.bossId))
  const bloodied = hp?.bloodied ?? false
  const current = hp && bloodied && phase2Art ? phase2Art : mainArt
  return (
    <Panel tone="rose" hero icon={<Crown size={16} />} title={boss.name} subtitle={boss.role} actions={<Pill tone="rose" mono>CR {boss.cr}</Pill>}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {current && (
          <div className="w-full shrink-0 flex flex-col gap-1.5 sm:w-48">
            <button
              type="button"
              onClick={() =>
                showArt({
                  src: mainArt ?? current,
                  title: boss.name,
                  subtitle: boss.role,
                  primaryLabel: 'Phase 1',
                  alternate: phase2Art ? { label: 'Phase 2', src: phase2Art } : undefined,
                })
              }
              aria-label={`Enlarge ${boss.name}`}
              className="box-border block aspect-square w-full cursor-pointer overflow-hidden rounded-xl border border-rose-500/40 bg-stone-950 p-0"
            >
              <img src={current} alt="" className="h-full w-full object-cover" />
            </button>
            {phase2Art && (
              <p className="m-0 text-center text-[11px] text-stone-400">
                {hp && bloodied ? 'Phase 2 (Bloodied)' : 'Phase 1'} · click for both
              </p>
            )}
          </div>
        )}
        <div className="min-w-0 flex-1 flex flex-col gap-3">
          {hp && (
            <div className="flex flex-col gap-2 rounded-lg border border-rose-500/25 bg-stone-950/60 p-2.5">
              <BloodiedControl bloodied={hp.bloodied} override={hp.override} busy={busy} onSet={hp.onSetBloodied} />
              <HpList trackers={hp.trackers} busy={busy} onChange={hp.onChange} />
            </div>
          )}
          <Fact label="Defense">
            AC {boss.ac} · {boss.hp} HP{boss.sharedHp && ' (shared)'}
            {boss.parts.length > 0 && (
              <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {boss.parts.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 rounded-lg border border-fuchsia-500/25 bg-stone-950/60 p-1.5">
                    <Portrait kind="boss-parts" id={partArtId(boss.bossId, p.name)} name={p.name} size="h-8 w-8" square />
                    <span className="text-[11px]">
                      {p.count > 1 && `${p.count} × `}
                      <strong className="text-fuchsia-200">{p.name}</strong>: AC {p.ac}
                      {p.hp !== null && `, ${p.hp} HP${p.count > 1 ? ' each' : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Fact>
          <Fact label="Numbers">
            +{boss.attack} to hit · save DC {boss.dc} · Boss PB +{boss.pb} · about {boss.dpr} damage per round
          </Fact>
        </div>
      </div>

      <Fact label="Abilities">
        <StatLine abilities={scoresOf(boss.abilities)} saves={savesOf(boss.abilities)} />
        {boss.partAbilities.map((p) => (
          <div key={p.name} className="mt-1.5 flex flex-col gap-1">
            <span className="text-[11px] text-stone-400">{p.name}:</span>
            <StatLine abilities={scoresOf(p.abilities)} saves={savesOf(p.abilities)} />
          </div>
        ))}
        {boss.profileNote && <p className="m-0 mt-1 text-[11px] text-stone-500">{boss.profileNote}</p>}
      </Fact>

      {boss.traits.length > 0 && <Fact label="Traits">{boss.traits.join(' ')}</Fact>}

      <Fact label="Attacks">
        <ul className="m-0 list-none flex flex-col gap-1.5 p-0">
          {boss.attacks.map((a, i) => {
            const heading = a.group && a.group !== boss.attacks[i - 1]?.group ? a.group : null
            return (
              <li key={a.name}>
                {heading && <div className="text-[11px] font-semibold text-stone-500">{heading}:</div>}
                <strong className="text-stone-100">
                  {a.name}
                  {a.count > 1 && ` ×${a.count}`}
                </strong>
                : {attackLine(a, boss)}. {a.text}
              </li>
            )
          })}
        </ul>
      </Fact>

      {boss.specials.length > 0 && (
        <Fact label="Specials">
          <ul className="m-0 list-none flex flex-col gap-1.5 p-0">
            {boss.specials.map((s) => (
              <li key={s.name}>
                <strong className="text-stone-100">{s.name}</strong>: {s.text}
              </li>
            ))}
          </ul>
        </Fact>
      )}

      <Fact label="Legendary">
        {boss.legendaryActions > 0 ? (
          <>
            {boss.legendaryActions} Legendary Action{boss.legendaryActions === 1 ? '' : 's'}
            {boss.phase2ExtraLegendaryActions > 0 && ` (+${boss.phase2ExtraLegendaryActions} in phase 2)`}:{' '}
            {boss.legendaryOptions.map((o) => `${o.name} (${o.text})`).join('; ')}. {boss.legendaryRefresh}
          </>
        ) : (
          'No Legendary Actions'
        )}
        {' · '}
        {boss.legendaryResistances > 0
          ? `${boss.legendaryResistances} Legendary Resistance${boss.legendaryResistances === 1 ? '' : 's'}`
          : 'no Legendary Resistances'}
      </Fact>

      <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <strong className="flex items-center gap-1.5 text-xs text-amber-200">
            <Zap size={13} /> Shift Action: {boss.shiftAction.name}
            <span className="font-normal text-stone-400">(initiative count 20)</span>
          </strong>
          {onTrigger && <RevealControl shown={revealed} busy={busy} onReveal={onTrigger} label="Trigger Shift Action" shownLabel="Triggered" />}
        </div>
        <p className="m-0 text-xs text-stone-200">{boss.shiftAction.text}</p>
      </div>
    </Panel>
  )
}

/** Restless Stone's Shift Actions in a non-boss room. */
export function RestlessShifts({ room, partyLevel, busy, act }: { room: Room; partyLevel: number; busy: boolean; act: Act }) {
  if (!room.shifts?.length || room.kind === 'boss') return null
  const dc = floorBossDc(room.floor, partyLevel)
  return (
    <Panel tone="amber" icon={<Zap size={15} />} title="Restless Stone">
      {room.shifts.map((s) => {
        const action = bossOf(s.bossId).shiftAction
        return (
          <div key={s.bossId} className={cx(WELL, 'flex flex-col gap-1')}>
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <strong className="text-xs text-amber-200">{action.name}</strong>
              <RevealControl
                shown={s.revealed}
                busy={busy}
                label="Trigger Shift Action"
                shownLabel="Triggered"
                onReveal={() => act((st) => reveal(st, { shift: s.bossId }))}
              />
            </div>
            <p className="m-0 text-[11px] text-stone-300">{action.text.replace(/\{dc\}/g, String(dc))}</p>
          </div>
        )
      })}
    </Panel>
  )
}

/** The fight for a room, as the DM sees it. */
export function DmFight({ state, room, busy, act }: { state: RunState; room: Room; busy: boolean; act: Act }) {
  const { run } = state
  const ctx = { partyLevel: run.partyLevel, pressures: run.pressures }
  const trackers = hpTrackers(room, ctx)
  const onChange = (key: string, amount: number) => act((s) => changeHp(s, key, amount))
  if (room.boss) {
    const boss = buildBoss(room.boss.id, run.partyLevel, room.boss.partySize, run.pressures)
    const shift = room.shifts?.find((s) => s.bossId === room.boss!.id)
    return (
      <BossBlock
        boss={boss}
        revealed={Boolean(shift?.revealed)}
        busy={busy}
        onTrigger={() => act((s) => reveal(s, { shift: room.boss!.id }))}
        hp={{
          trackers,
          bloodied: bossBloodied(room, ctx),
          override: room.hp?.bossBloodied ?? null,
          onChange,
          onSetBloodied: (value) => act((s) => setBossBloodied(s, value)),
        }}
      />
    )
  }
  const needsEncounter = !room.encounter && (room.kind === 'combat' || room.kind === 'elite')
  return (
    <>
      {needsEncounter && (
        <Panel tone="rose" icon={<Skull size={15} />} title="No encounter yet">
          <button type="button" disabled={busy} className={`${PRIMARY_BUTTON} self-start`} onClick={() => act((s) => rerollEncounter(s, Math.random))}>
            Roll the encounter
          </button>
        </Panel>
      )}
      {room.encounter && <EncounterPanel encounter={room.encounter} trackers={trackers} busy={busy} act={act} />}
      <RestlessShifts room={room} partyLevel={run.partyLevel} busy={busy} act={act} />
    </>
  )
}
