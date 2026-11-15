// DM screen: look up any table the generators use (design bible: App
// requirements > DM view, "pull up any table"). Read-only views of the data
// files, so a change to the data shows up here with no code changes.
import { useState, type ReactNode } from 'react'
import { Table2 } from 'lucide-react'
import enemyData from '../data/enemies.json'
import trickData from '../data/room-tricks.json'
import conditionData from '../data/room-conditions.json'
import lootRolls from '../data/loot-rolls.json'
import lootItems from '../data/loot-items.json'
import relicData from '../data/relics.json'
import { BOSSES } from '../rules/bosses'
import { crLabel } from '../rules/encounters'
import { baseName } from '../rules/gear'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { SMALL_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'

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
    <Panel
      hero
      className="mt-6"
      icon={<Table2 size={16} />}
      title="Tables"
      subtitle="Look up any table the generators use. Only you see this."
    >
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a table">
        {(Object.entries(TABLES) as [TableId, string][]).map(([id, name]) => (
          <button
            key={id}
            type="button"
            aria-pressed={table === id}
            onClick={() => setTable(table === id ? '' : id)}
            className={cx(
              SMALL_BUTTON,
              table === id ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800',
            )}
          >
            {name}
          </button>
        ))}
      </div>
      {table === '' && <p className="m-0 text-xs text-stone-500">Pick a table above.</p>}
      {table === 'roster' && <Roster />}
      {table === 'bosses' && <Bosses />}
      {table === 'tricks' && <Tricks />}
      {table === 'conditions' && <Conditions />}
      {table === 'floorRoll' && <FloorRoll />}
      {table === 'items' && <Items />}
      {table === 'trophies' && <Trophies />}
      {table === 'relics' && <Relics />}
    </Panel>
  )
}

/** A styled table: header row, then rows; scrolls sideways on narrow screens. */
function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-800">
      <table className="w-full min-w-[36rem] border-collapse text-left text-xs text-stone-200">
        <thead className="bg-stone-950/80">
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap border-b border-stone-800 px-2.5 py-2 text-[0.625rem] font-bold uppercase tracking-wider text-stone-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-stone-950/40 [&>tr>td]:border-t [&>tr>td]:border-stone-800/70 [&>tr>td]:px-2.5 [&>tr>td]:py-1.5 [&>tr>td]:align-top">
          {children}
        </tbody>
      </table>
    </div>
  )
}

/** A numbered list (d-roll tables like trinkets and wondrous items). */
function RollList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>{title}</SectionLabel>
      <ol className="m-0 flex flex-col gap-1 pl-6 text-xs text-stone-300 marker:font-mono marker:text-stone-500">{children}</ol>
    </div>
  )
}

const Name = ({ children }: { children: ReactNode }) => <strong className="text-stone-50">{children}</strong>

function Roster() {
  return (
    <div className="flex flex-col gap-4">
      {enemyData.families.map((f) => (
        <div key={f.id} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-sm font-bold text-stone-100">{f.name}</h3>
            <Pill mono>Floors {Object.keys(f.floorWeights).join(', ')}</Pill>
          </div>
          <p className="m-0 text-xs text-stone-400">{f.twist}</p>
          <DataTable head={['Creature', 'Role', 'CR', 'Reskin of']}>
            {enemyData.creatures
              .filter((c) => c.family === f.id)
              .map((c) => (
                <tr key={c.id}>
                  <td>
                    <Name>{c.name}</Name>
                  </td>
                  <td>{c.role}</td>
                  <td className="font-mono">{crLabel(c.cr)}</td>
                  <td>{c.reskin}</td>
                </tr>
              ))}
          </DataTable>
        </div>
      ))}
    </div>
  )
}

function Bosses() {
  return (
    <DataTable head={['Floor', 'Boss', 'Role', 'Shift Action']}>
      {BOSSES.map((b) => (
        <tr key={b.id}>
          <td className="font-mono">{b.floor}</td>
          <td>
            <Name>{b.name}</Name>
          </td>
          <td>{b.role}</td>
          <td>
            <strong className="text-amber-200">{b.shiftAction.name}</strong>: {b.shiftAction.text.replace(/DC \{dc\}/g, 'boss-DC')}
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

function Tricks() {
  return (
    <DataTable head={['Floor', 'Trick', 'Trigger', 'Effect', 'Counterplay']}>
      {trickData.tricks.map((t) => (
        <tr key={t.id}>
          <td className="font-mono">{t.floor}</td>
          <td>
            <Name>{t.name}</Name>
          </td>
          <td>{t.trigger}</td>
          <td>{t.effect}</td>
          <td>{t.counterplay}</td>
        </tr>
      ))}
    </DataTable>
  )
}

function Conditions() {
  return (
    <DataTable head={['d20', 'Condition', 'Hidden Sight hint']}>
      {conditionData.conditions.map((c) => (
        <tr key={c.roll}>
          <td className="font-mono">{c.roll}</td>
          <td>{c.condition}</td>
          <td className="italic text-stone-400">{c.hint}</td>
        </tr>
      ))}
    </DataTable>
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
    <DataTable head={['Result', ...lootRolls.floorRoll.map((r) => `Floor ${r.floor}`)]}>
      {kinds.map((k) => (
        <tr key={k}>
          <td className="capitalize">
            <Name>{k}</Name>
          </td>
          {lootRolls.floorRoll.map((r) => (
            <td key={r.floor} className="font-mono">
              {range(r.floor, k)}
            </td>
          ))}
        </tr>
      ))}
    </DataTable>
  )
}

function Items() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className={cx(WELL, 'flex flex-col gap-4')}>
        <RollList title="Consumables (d12)">
          {lootItems.consumables.map((c) => (
            <li key={c.id}>
              <Name>{c.name}</Name>: {c.effect}
            </li>
          ))}
        </RollList>
        <RollList title="Gear (d20)">
          {lootItems.gear.map((g) => (
            <li key={g.id}>
              <Name>{g.name}</Name> <span className="text-stone-500">(d{g.bases.length}: {g.bases.map(baseName).join(', ').toLowerCase()})</span>: {g.property}
            </li>
          ))}
        </RollList>
        <RollList title="Trinkets (d20)">
          {lootItems.trinkets.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </RollList>
      </div>
      <div className={cx(WELL, 'flex flex-col gap-4')}>
        {Object.entries(lootItems.wondrous).map(([rarity, list]) => (
          <RollList key={rarity} title={`Wondrous, ${lootRolls.rarities.find((r) => r.id === rarity)?.name} (d${list.length})`}>
            {list.map((w) => (
              <li key={w.id}>
                <Name>{w.name}</Name>: {w.effect}
              </li>
            ))}
          </RollList>
        ))}
      </div>
    </div>
  )
}

function Trophies() {
  return (
    <DataTable head={['Boss', 'Trophy', 'Rarity', 'Effect']}>
      {lootItems.trophies.map((t) => (
        <tr key={t.id}>
          <td>{BOSSES.find((b) => b.id === t.bossId)?.name}</td>
          <td>
            <Name>{t.name}</Name>
          </td>
          <td className="whitespace-nowrap">{lootRolls.rarities.find((r) => r.id === t.rarity)?.name}</td>
          <td>{t.effect}</td>
        </tr>
      ))}
    </DataTable>
  )
}

function Relics() {
  return (
    <DataTable head={['Relic', 'Build', 'Dormant', 'Woken (adds)']}>
      {relicData.relics.map((r) => (
        <tr key={r.id}>
          <td>
            <Name>{r.name}</Name>
          </td>
          <td>{r.build}</td>
          <td>{r.dormant}</td>
          <td>{r.woken}</td>
        </tr>
      ))}
    </DataTable>
  )
}
