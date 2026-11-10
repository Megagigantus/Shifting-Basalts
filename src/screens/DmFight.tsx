// DM screen: the fight in the current room. An encounter's creatures (with
// roster CR, reskin source, twist and echo boons) or a boss's full stat block
// built from the benchmarks. Players never receive any of this.
import type { RunState } from '../model/run'
import type { Room } from '../rules/rooms'
import { crLabel, creatureOf, creatureXp, familyOf, pushedStats, type Encounter } from '../rules/encounters'
import { bossOf, buildBoss, floorBossDc, type BossStats } from '../rules/bosses'
import { boon } from '../rules/boons'
import { rerollEncounter, reveal } from '../rules/roomFlow'
import { Art } from './Art'

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

export function EncounterPanel({ encounter, busy, act }: { encounter: Encounter; busy: boolean; act: Act }) {
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
                  damage per round, save DC {pushed.dc}.
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
              </div>
            </li>
          )
        })}
      </ul>
      {families.map((f) => (
        <p key={f.id} className="hint">
          {f.name} twist: {f.twist}
        </p>
      ))}
    </div>
  )
}

const attackLine = (a: BossStats['attacks'][number], boss: BossStats) =>
  a.kind === 'save'
    ? `DC ${boss.dc} ${a.save} save, ${a.damage.average} (${a.damage.expression}) ${a.type} damage`
    : `+${boss.attack} to hit (${a.kind}), ${a.damage.average} (${a.damage.expression}) ${a.type} damage`

export function BossBlock({ boss, revealed, busy, onTrigger }: { boss: BossStats; revealed: boolean; busy: boolean; onTrigger?: () => void }) {
  return (
    <div className="fight boss-block">
      <Art kind="bosses" id={boss.bossId} alt={boss.name} className="boss-portrait" />
      <h4>
        {boss.name} <span className="hint">CR {boss.cr}</span>
      </h4>
      <p className="hint">{boss.role}</p>
      <dl className="room-facts">
        <dt>Defense</dt>
        <dd>
          AC {boss.ac} · {boss.hp} HP{boss.sharedHp && ' (shared)'}
          {boss.parts.length > 0 && (
            <ul className="plain-list">
              {boss.parts.map((p) => (
                <li key={p.name}>
                  {p.count > 1 && `${p.count} × `}
                  {p.name}: AC {p.ac}
                  {p.hp !== null && `, ${p.hp} HP${p.count > 1 ? ' each' : ''}`}
                </li>
              ))}
            </ul>
          )}
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
              {boss.legendaryOptions.map((o) => `${o.name} (${o.text})`).join('; ')}
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
  if (room.boss) {
    const boss = buildBoss(room.boss.id, run.partyLevel, room.boss.partySize, run.pressures)
    const shift = room.shifts?.find((s) => s.bossId === room.boss!.id)
    return (
      <BossBlock
        boss={boss}
        revealed={Boolean(shift?.revealed)}
        busy={busy}
        onTrigger={() => act((s) => reveal(s, { shift: room.boss!.id }))}
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
      {room.encounter && <EncounterPanel encounter={room.encounter} busy={busy} act={act} />}
      <RestlessShifts room={room} partyLevel={run.partyLevel} busy={busy} act={act} />
    </>
  )
}
