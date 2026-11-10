// DM screen: look up any table the generators use (design bible: App
// requirements > DM view, "pull up any table"). Read-only views of the data
// files, so a change to the data shows up here with no code changes.
import { useState } from 'react'
import enemyData from '../data/enemies.json'
import trickData from '../data/room-tricks.json'
import conditionData from '../data/room-conditions.json'
import lootRolls from '../data/loot-rolls.json'
import lootItems from '../data/loot-items.json'
import relicData from '../data/relics.json'
import { BOSSES } from '../rules/bosses'
import { crLabel } from '../rules/encounters'

const TABLES = {
  roster: 'Enemy roster',
  bosses: 'Bosses',
  tricks: 'Room tricks',
  conditions: 'Secret conditions',
  floorRoll: 'Floor loot roll (d100)',
  items: 'Loot items',
  trophies: 'Boss trophies',
  relics: "Thils's Vault relics",
} as const
type TableId = keyof typeof TABLES

export function TableViewer() {
  const [table, setTable] = useState<TableId | ''>('')
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Tables</h2>
        <select value={table} onChange={(e) => setTable(e.target.value as TableId | '')} aria-label="Pick a table">
          <option value="">Pick a table…</option>
          {Object.entries(TABLES).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {table === '' && <p className="hint">Look up any table the generators use. Only you see this.</p>}
      <div className="table-view">
        {table === 'roster' && <Roster />}
        {table === 'bosses' && <Bosses />}
        {table === 'tricks' && <Tricks />}
        {table === 'conditions' && <Conditions />}
        {table === 'floorRoll' && <FloorRoll />}
        {table === 'items' && <Items />}
        {table === 'trophies' && <Trophies />}
        {table === 'relics' && <Relics />}
      </div>
    </section>
  )
}

function Roster() {
  return (
    <>
      {enemyData.families.map((f) => (
        <div key={f.id}>
          <h3>
            {f.name} <span className="hint">floors {Object.keys(f.floorWeights).join(', ')}</span>
          </h3>
          <p className="hint">{f.twist}</p>
          <table className="party-table">
            <thead>
              <tr>
                <th>Creature</th>
                <th>Role</th>
                <th>CR</th>
                <th>Reskin of</th>
              </tr>
            </thead>
            <tbody>
              {enemyData.creatures
                .filter((c) => c.family === f.id)
                .map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.role}</td>
                    <td>{crLabel(c.cr)}</td>
                    <td>{c.reskin}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}

function Bosses() {
  return (
    <table className="party-table">
      <thead>
        <tr>
          <th>Floor</th>
          <th>Boss</th>
          <th>Role</th>
          <th>Shift Action</th>
        </tr>
      </thead>
      <tbody>
        {BOSSES.map((b) => (
          <tr key={b.id}>
            <td>{b.floor}</td>
            <td>{b.name}</td>
            <td>{b.role}</td>
            <td>
              <strong>{b.shiftAction.name}</strong>: {b.shiftAction.text.replace(/DC \{dc\}/g, 'boss-DC')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Tricks() {
  return (
    <table className="party-table">
      <thead>
        <tr>
          <th>Floor</th>
          <th>Trick</th>
          <th>Trigger</th>
          <th>Effect</th>
          <th>Counterplay</th>
        </tr>
      </thead>
      <tbody>
        {trickData.tricks.map((t) => (
          <tr key={t.id}>
            <td>{t.floor}</td>
            <td>{t.name}</td>
            <td>{t.trigger}</td>
            <td>{t.effect}</td>
            <td>{t.counterplay}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Conditions() {
  return (
    <table className="party-table">
      <thead>
        <tr>
          <th>d20</th>
          <th>Condition</th>
          <th>Hidden Sight hint</th>
        </tr>
      </thead>
      <tbody>
        {conditionData.conditions.map((c) => (
          <tr key={c.roll}>
            <td>{c.roll}</td>
            <td>{c.condition}</td>
            <td>{c.hint}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FloorRoll() {
  const kinds = lootRolls.floorRoll[0].table.map((r) => r.kind)
  const range = (floor: number, kind: string) => {
    const table = lootRolls.floorRoll.find((r) => r.floor === floor)!.table
    const i = table.findIndex((r) => r.kind === kind)
    const from = i === 0 ? 1 : table[i - 1].upTo + 1
    return `${from}–${table[i].upTo}`
  }
  return (
    <table className="party-table">
      <thead>
        <tr>
          <th>Result</th>
          {lootRolls.floorRoll.map((r) => (
            <th key={r.floor}>Floor {r.floor}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {kinds.map((k) => (
          <tr key={k}>
            <td>{k}</td>
            {lootRolls.floorRoll.map((r) => (
              <td key={r.floor}>{range(r.floor, k)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Items() {
  return (
    <>
      <h3>Consumables (d12)</h3>
      <ol className="table-list">
        {lootItems.consumables.map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>: {c.effect}
          </li>
        ))}
      </ol>
      <h3>Gear (d12)</h3>
      <ol className="table-list">
        {lootItems.gear.map((g) => (
          <li key={g.id}>
            <strong>{g.name}</strong> ({g.base}): {g.property}
          </li>
        ))}
      </ol>
      {Object.entries(lootItems.wondrous).map(([rarity, list]) => (
        <div key={rarity}>
          <h3>
            Wondrous, {lootRolls.rarities.find((r) => r.id === rarity)?.name} (d{list.length})
          </h3>
          <ol className="table-list">
            {list.map((w) => (
              <li key={w.id}>
                <strong>{w.name}</strong>: {w.effect}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <h3>Trinkets (d20)</h3>
      <ol className="table-list">
        {lootItems.trinkets.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </>
  )
}

function Trophies() {
  return (
    <table className="party-table">
      <thead>
        <tr>
          <th>Boss</th>
          <th>Trophy</th>
          <th>Rarity</th>
          <th>Effect</th>
        </tr>
      </thead>
      <tbody>
        {lootItems.trophies.map((t) => (
          <tr key={t.id}>
            <td>{BOSSES.find((b) => b.id === t.bossId)?.name}</td>
            <td>{t.name}</td>
            <td>{lootRolls.rarities.find((r) => r.id === t.rarity)?.name}</td>
            <td>{t.effect}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Relics() {
  return (
    <table className="party-table">
      <thead>
        <tr>
          <th>Relic</th>
          <th>Build</th>
          <th>Dormant</th>
          <th>Woken (adds)</th>
        </tr>
      </thead>
      <tbody>
        {relicData.relics.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td>{r.build}</td>
            <td>{r.dormant}</td>
            <td>{r.woken}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
