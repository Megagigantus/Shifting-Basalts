// DM screen: the fight in the current room. An encounter's creatures (with
// roster CR, reskin source, twist and echo boons) or a boss's full stat block
// built from the benchmarks. Players never receive any of this.
import type { RunState } from '../model/run'
import type { Room } from '../rules/rooms'
import { crLabel, creatureOf, creatureStats, creatureXp, familyOf, pushedStats, type Encounter } from '../rules/encounters'
import { bossBloodied, hpTrackers, type Tracker } from '../rules/hp'
import { BloodiedControl, HpList, StatLine } from './HpTracker'
import { bossOf, buildBoss, floorBossDc, type AbilityProfile, type BossStats } from '../rules/bosses'
import { ABILITIES, type Ability } from '../rules/encounters'
import { boon } from '../rules/boons'
import { changeHp, rerollEncounter, reveal, setBossBloodied } from '../rules/roomFlow'
import { Art } from './Art'
import { artUrl, partArtId, phase2ArtId } from '../art'

type Step = (s: RunState) => RunState
type Act = (step: Step, confirmText?: string) => void

function RevealButton({ shown, busy, onReveal, label = 'Reveal' }: { shown: boolean; busy: boolean; onReveal: () => void; label?: string }) {
  return shown ? (
    <span className="tag shown">shown to players</span>
  ) : (
    <>
      <span className="tag hidden-tag">hidden</span>
      <button type="button" className="quiet" disabled={busy} onClick={onReveal}>
        {label}
      </button>
    </>
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
    <div className="fight">
      <div className="panel-header">
        <h4>
          Encounter: {family.name}
          {encounter.splashFamily && ` + ${familyOf(encounter.splashFamily).name}`}
        </h4>
        <span className="row-actions">
          {!allShown && (
            <button type="button" className="quiet" disabled={busy} onClick={() => act((s) => reveal(s, 'enemies'))}>
              Reveal all
            </button>
          )}
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() => act((s) => rerollEncounter(s, Math.random), 'Roll this encounter again?')}
          >
            Reroll encounter
          </button>
        </span>
      </div>
      <p className="hint">
        Budget {encounter.budget.toLocaleString()} XP · used {encounter.xp.toLocaleString()} XP
        {encounter.elite &&
          ` · elite extra (${encounter.elite === 'push' ? 'one creature +2 CR' : "a next floor's creature"}): ${total.toLocaleString()} XP in all`}
        {' '}· CR cap {encounter.maxCr}
      </p>
      <ul className="plain-list creatures">
        {encounter.groups.map((g, i) => {
          const c = creatureOf(g.creatureId)
          const pushed = pushedStats(g)
          return (
            <li key={`${g.creatureId}-${g.cr}-${i}`} className="with-portrait">
              <Art kind="creatures" id={g.creatureId} alt={c.name} />
              <div>
              <strong>
                {g.count} × {c.name}
              </strong>{' '}
              <span className="hint">
                {c.role}, CR {crLabel(g.cr)} · reskin of {c.reskin}
                {g.source === 'splash' && ' · splash'}
                {g.source === 'elite' && ' · elite extra'}
              </span>{' '}
              <RevealButton shown={g.revealed} busy={busy} onReveal={() => act((s) => reveal(s, { enemy: i }))} />
              {pushed && (
                <div className="hint">
                  Pushed from CR {crLabel(c.cr)}: use AC {pushed.ac}, HP {pushed.hp}, +{pushed.attack} to hit, about {pushed.dpr}{' '}
                  damage per round, save DC {pushed.dc}. The saves below include the higher PB.
                </div>
              )}
              {g.boons?.map((b, j) => {
                const data = boon(b.id)
                return (
                  <div key={j} className="hint">
                    Echo {g.count > 1 ? j + 1 : ''} carries <strong>{data.name}</strong> (Level {b.level}):{' '}
                    {data.levels.slice(0, b.level).join(' ')}
                  </div>
                )
              })}
              <StatLine {...creatureStats(g)} />
              <HpList
                trackers={trackers.filter((t) => t.group === i)}
                busy={busy}
                onChange={(key, amount) => act((s) => changeHp(s, key, amount))}
              />
              </div>
            </li>
          )
        })}
      </ul>
      {families.map((f) => (
        <div key={f.id} className="with-portrait family-row">
          <Art kind="families" id={f.id} alt={f.name} />
          <p className="hint">
            {f.name} twist: {f.twist}
          </p>
        </div>
      ))}
    </div>
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
  const hasPhase2 = Boolean(artUrl('bosses', phase2ArtId(boss.bossId)))
  const bloodied = hp?.bloodied ?? false
  return (
    <div className="fight boss-block">
      {hasPhase2 ? (
        <div className="boss-phases">
          <figure className={hp && !bloodied ? 'is-current' : undefined}>
            <Art kind="bosses" id={boss.bossId} alt={`${boss.name}, phase 1`} className="boss-portrait" />
            <figcaption className="hint">Phase 1</figcaption>
          </figure>
          <figure className={hp && bloodied ? 'is-current' : undefined}>
            <Art kind="bosses" id={phase2ArtId(boss.bossId)} alt={`${boss.name}, phase 2`} className="boss-portrait" />
            <figcaption className="hint">Phase 2 (Bloodied)</figcaption>
          </figure>
        </div>
      ) : (
        <Art kind="bosses" id={boss.bossId} alt={boss.name} className="boss-portrait" />
      )}
      <h4>
        {boss.name} <span className="hint">CR {boss.cr}</span>
      </h4>
      <p className="hint">{boss.role}</p>
      {hp && (
        <div className="boss-hp">
          <BloodiedControl bloodied={hp.bloodied} override={hp.override} busy={busy} onSet={hp.onSetBloodied} />
          <HpList trackers={hp.trackers} busy={busy} onChange={hp.onChange} />
        </div>
      )}
      <dl className="room-facts">
        <dt>Defense</dt>
        <dd>
          AC {boss.ac} · {boss.hp} HP{boss.sharedHp && ' (shared)'}
          {boss.parts.length > 0 && (
            <ul className="plain-list">
              {boss.parts.map((p) => (
                <li key={p.name} className="with-portrait part-row">
                  <Art kind="boss-parts" id={partArtId(boss.bossId, p.name)} alt={p.name} />
                  <span>
                    {p.count > 1 && `${p.count} × `}
                    {p.name}: AC {p.ac}
                    {p.hp !== null && `, ${p.hp} HP${p.count > 1 ? ' each' : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Abilities</dt>
        <dd>
          <StatLine abilities={scoresOf(boss.abilities)} saves={savesOf(boss.abilities)} />
          {boss.partAbilities.map((p) => (
            <div key={p.name}>
              <span className="hint">{p.name}:</span>
              <StatLine abilities={scoresOf(p.abilities)} saves={savesOf(p.abilities)} />
            </div>
          ))}
          {boss.profileNote && <div className="hint">{boss.profileNote}</div>}
        </dd>
        <dt>Numbers</dt>
        <dd>
          +{boss.attack} to hit · save DC {boss.dc} · Boss PB +{boss.pb} · about {boss.dpr} damage per round
        </dd>
        {boss.traits.length > 0 && (
          <>
            <dt>Traits</dt>
            <dd>{boss.traits.join(' ')}</dd>
          </>
        )}
        <dt>Attacks</dt>
        <dd>
          <ul className="plain-list">
            {boss.attacks.map((a, i) => {
              const heading = a.group && a.group !== boss.attacks[i - 1]?.group ? a.group : null
              return (
                <li key={a.name}>
                  {heading && <div className="hint">{heading}:</div>}
                  <strong>
                    {a.name}
                    {a.count > 1 && ` ×${a.count}`}
                  </strong>
                  : {attackLine(a, boss)}. {a.text}
                </li>
              )
            })}
          </ul>
        </dd>
        {boss.specials.length > 0 && (
          <>
            <dt>Specials</dt>
            <dd>
              <ul className="plain-list">
                {boss.specials.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>: {s.text}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
        <dt>Legendary</dt>
        <dd>
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
        </dd>
        <dt>Shift Action</dt>
        <dd>
          <strong>{boss.shiftAction.name}</strong> (initiative count 20): {boss.shiftAction.text}{' '}
          {onTrigger && <RevealButton shown={revealed} busy={busy} onReveal={onTrigger} label="Trigger Shift Action" />}
        </dd>
      </dl>
    </div>
  )
}

/** Restless Stone's Shift Actions in a non-boss room. */
export function RestlessShifts({ room, partyLevel, busy, act }: { room: Room; partyLevel: number; busy: boolean; act: Act }) {
  if (!room.shifts?.length || room.kind === 'boss') return null
  const dc = floorBossDc(room.floor, partyLevel)
  return (
    <div className="fight">
      <h4>Restless Stone</h4>
      <ul className="plain-list">
        {room.shifts.map((s) => {
          const action = bossOf(s.bossId).shiftAction
          return (
            <li key={s.bossId}>
              <strong>{action.name}</strong>: {action.text.replace(/\{dc\}/g, String(dc))}{' '}
              <RevealButton
                shown={s.revealed}
                busy={busy}
                label="Trigger Shift Action"
                onReveal={() => act((st) => reveal(st, { shift: s.bossId }))}
              />
            </li>
          )
        })}
      </ul>
    </div>
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
        <button type="button" disabled={busy} onClick={() => act((s) => rerollEncounter(s, Math.random))}>
          Roll the encounter
        </button>
      )}
      {room.encounter && <EncounterPanel encounter={room.encounter} trackers={trackers} busy={busy} act={act} />}
      <RestlessShifts room={room} partyLevel={run.partyLevel} busy={busy} act={act} />
    </>
  )
}
