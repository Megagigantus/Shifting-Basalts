// Player screen: the run their character is in, read-only. Shows where the
// party is and everyone's boons; never anything from the DM-only data.
import { Fragment, useState } from 'react'
import type { RunState } from '../model/run'
import { boonSummary } from '../rules/boons'
import { floorInfo, LAST_FLOOR, PRESSURES } from '../rules/run'
import { canExtract, isBossRoom, lootKeptIfExtracting } from '../rules/runFlow'
import { BoonList } from './BoonList'
import { PlayerDraft } from './PlayerDraft'
import { PlayerRoom } from './PlayerRoom'
import { submitChoice, useChoices, useLootRequests } from '../runStore'
import { PlayerLoot } from './LootScreens'
import { RecoveryPanel } from './RecoveryPanel'

interface Props {
  state: RunState
  myCharacterIds: string[]
  /** The DM's read-only preview. */
  readOnly?: boolean
}

export function PlayerRun({ state, myCharacterIds, readOnly = false }: Props) {
  const { run, players } = state
  const choices = useChoices(run.id)
  const requests = useLootRequests(run.id)
  const [open, setOpen] = useState<string | null>(myCharacterIds[0] ?? null)
  const floor = floorInfo(run.floor)
  const bossRoom = isBossRoom(state)

  const where = run.awaitingChoice
    ? `Floor ${run.floor} boss defeated: descend or extract?`
    : bossRoom
      ? run.floor === LAST_FLOOR
        ? 'Floor 5: the legendary boss'
        : `Floor ${run.floor}: boss room`
      : `Floor ${run.floor}: room ${run.room} of ${floor.rooms}`

  return (
    <section className="panel">
      <h2>Current run</h2>
      <div className="run-where">{where}</div>
      <div className="hint">
        Hazard class {floor.hazard} · party level {run.partyLevel} · rewards ×{run.entryMultiplier}
      </div>
      {run.pressures.length > 0 && (
        <div className="hint">
          Pressures: {run.pressures.map((id) => PRESSURES.find((p) => p.id === id)?.name ?? id).join(', ')}
        </div>
      )}
      <p className="hint">
        Loot kept if the party extracts now:{' '}
        {canExtract(state) ? `${lootKeptIfExtracting(state)}%` : 'extraction opens after a boss'}
      </p>

      <PlayerRoom
        key={`${run.floor}-${run.room}`}
        state={state}
        me={players.find((p) => myCharacterIds.includes(p.characterId)) ?? null}
        readOnly={readOnly}
      />

      {players
        .filter((p) => myCharacterIds.includes(p.characterId))
        .map((p) => (
          <PlayerDraft key={p.characterId} state={state} player={p} sent={choices[p.characterId]} readOnly={readOnly} />
        ))}

      {players
        .filter((p) => myCharacterIds.includes(p.characterId))
        .map((p) => (
          <RecoveryPanel
            key={p.characterId}
            player={p}
            busy={readOnly || Boolean(choices[p.characterId] && !choices[p.characterId].error)}
            onSpend={(choice) => submitChoice(run.id, p.characterId, choice, null)}
          />
        ))}

      <PlayerLoot state={state} myCharacterIds={myCharacterIds} requests={requests} readOnly={readOnly} />

      <table className="party-table">
        <thead>
          <tr>
            <th>Party</th>
            <th title="Devotions earned this run">Devotions</th>
            <th title="Boss Quantum Basalts, before bonuses. Lost on death.">QB earned</th>
            <th title="Quantum Basalts from passing. Kept even on death.">QB passed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const mine = myCharacterIds.includes(p.characterId)
            return (
              <Fragment key={p.characterId}>
                <tr className={`${p.alive ? '' : 'fallen'} ${mine ? 'mine' : ''}`}>
                  <td>
                    {p.name}
                    {mine && <span className="tag">you</span>}
                    {boonSummary(p.slots, p.hiddenBoonId) && (
                      <div className="hint">{boonSummary(p.slots, p.hiddenBoonId)}</div>
                    )}
                    {!p.alive && (
                      <div className="warning">
                        Fell on floor {p.diedOnFloor} · locked out {p.lockoutDays} days
                      </div>
                    )}
                  </td>
                  <td>{p.devotions}</td>
                  <td>{p.alive ? p.quantumBasaltsEarned : `${p.quantumBasaltsEarned} (forfeit)`}</td>
                  <td>{p.quantumBasaltsPassed}</td>
                  <td>
                    <button type="button" onClick={() => setOpen(open === p.characterId ? null : p.characterId)}>
                      {open === p.characterId ? 'Hide boons' : 'Boons'}
                    </button>
                  </td>
                </tr>
                {open === p.characterId && (
                  <tr className="boons-row">
                    <td colSpan={5}>
                      <BoonList player={p} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
