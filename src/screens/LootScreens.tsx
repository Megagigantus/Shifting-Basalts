// Loot screens: the party's pool (DM and players), strider remains and shrine
// offerings, the extraction share, Thils's Vault, and characters' own loot.
// Run loot is shared party information, so players see the whole pool.
import { useMemo, useState, type ReactNode } from 'react'
import { Coins, Gem, Package, TriangleExclamationPoint } from 'lucide-react'
import type { OwnedLoot } from '../model/character'
import type { RunState } from '../model/run'
import {
  itemName,
  itemText,
  isFreeKeep,
  itemValue,
  keptPercent,
  keptValue,
  poolValue,
  rarityName,
  relicOf,
  rerollableItems,
  searchStriderRemains,
  shrineOffering,
  striderSearchDC,
  type LootItem,
  type LootPick,
  type Rarity,
} from '../rules/loot'
import { canExtract, extract, isFullClear } from '../rules/runFlow'
import { chooseRelic, relicStateFor, vaultPending } from '../rules/vault'
import { SceneBanner } from './Scene'
import { setLootRequests, submitChoice } from '../runStore'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { StatStrip } from '../ui/StatStrip'
import { FIELD, PRIMARY_BUTTON, QUIET_BUTTON, SMALL_BUTTON, WELL } from '../ui/styles'
import { cx, type Tone } from '../ui/tone'

type Act = (step: (s: RunState) => RunState, confirmText?: string) => void
const credits = (n: number) => `${n.toLocaleString()} cr`

const RARITY_TONES: Record<Rarity, Tone> = {
  common: 'stone',
  uncommon: 'emerald',
  rare: 'sky',
  'very-rare': 'violet',
  legendary: 'amber',
}

/** One item: name, type and rarity chips, value, floor, its text, and any controls. */
function ItemLine({ item, children }: { item: LootItem; children?: ReactNode }) {
  const kindPill =
    item.kind === 'trinket' ? (
      <Pill>Trinket</Pill>
    ) : item.kind === 'relic' ? (
      <Pill tone="fuchsia">Relic, {item.relicState}</Pill>
    ) : (
      <Pill tone={RARITY_TONES[item.rarity ?? 'common']}>
        {rarityName(item.rarity ?? 'common')} {item.kind}
      </Pill>
    )
  return (
    <li className={cx(WELL, 'flex flex-col gap-1.5')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <strong className="mr-1 text-xs text-stone-100">{itemName(item)}</strong>
        {kindPill}
        {item.kind !== 'relic' && (
          <Pill tone="purple" mono>
            {credits(itemValue(item))}
          </Pill>
        )}
        <Pill mono>F{item.floor}</Pill>
      </div>
      <p className="m-0 text-[0.6875rem] text-stone-400">{itemText(item)}</p>
      {children && <div className="flex flex-wrap items-center gap-1.5">{children}</div>}
    </li>
  )
}

function ItemList({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex list-none flex-col gap-1.5 p-0">{children}</ul>
}

function PoolSummary({ state }: { state: RunState }) {
  const loot = state.run.loot
  const open = canExtract(state)
  return (
    <StatStrip
      stats={[
        { label: 'Total haul', value: credits(poolValue(loot)), tone: 'purple' },
        { label: 'Credits', value: credits(loot?.credits ?? 0) },
        { label: 'Items', value: loot?.items.length ?? 0 },
        { label: 'Kept if extracting', value: open ? `${keptPercent(state)}%` : '–', tone: open ? 'emerald' : 'stone', hint: open ? undefined : 'Opens after a boss' },
        { label: 'Kept value', value: open ? credits(keptValue(state)) : '–', tone: open ? 'emerald' : 'stone' },
      ]}
    />
  )
}

/** Names of players who asked for an item. */
function requestedBy(state: RunState, requests: Record<string, string[]>, uid: string): string[] {
  return state.players.filter((p) => requests[p.characterId]?.includes(uid)).map((p) => p.name)
}

function WantedBy({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return <Pill tone="sky">Wanted by {names.join(', ')}</Pill>
}

// ---------------------------------------------------------------------------
// DM

export function DmLootPanel({ state, busy, act, requests }: { state: RunState; busy: boolean; act: Act; requests: Record<string, string[]> }) {
  const { run } = state
  const terrain = state.dm?.room?.terrain ?? []
  const items = run.loot?.items ?? []
  const searched = run.loot?.searched.includes(`${run.floor}-${run.room}`)
  const trinkets = items.filter((i) => i.kind === 'trinket')
  const targets = rerollableItems(state)
  const [offer, setOffer] = useState('')
  const [target, setTarget] = useState('')
  return (
    <Panel tone="purple" icon={<Package size={15} />} title="Run loot" subtitle="The party's shared pool. It's only kept if the party extracts after a boss.">
      <PoolSummary state={state} />
      {terrain.includes('strider-remains') && !run.awaitingChoice && (
        <div className={cx(WELL, 'flex flex-wrap items-center gap-2 text-xs')}>
          <span className="mr-auto">
            Strider remains: <span className="text-stone-400">Investigation DC {striderSearchDC(run.floor)}</span>
          </span>
          {searched ? (
            <Pill tone="emerald">Searched</Pill>
          ) : (
            <>
              <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => act((s) => searchStriderRemains(s, false, Math.random))}>
                Found a trinket
              </button>
              <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => act((s) => searchStriderRemains(s, true, Math.random))}>
                Beat it by 5: trinket and consumable
              </button>
            </>
          )}
        </div>
      )}
      {terrain.includes('shrine-to-thils') && trinkets.length > 0 && targets.length > 0 && (
        <div className={cx(WELL, 'flex flex-wrap items-center gap-2 text-xs')}>
          <span>Shrine to Thils: offer</span>
          <select value={offer} onChange={(e) => setOffer(e.target.value)} className={cx(FIELD, 'py-1 text-xs')}>
            <option value="">a trinket…</option>
            {trinkets.map((t) => (
              <option key={t.uid} value={t.uid}>
                {itemText(t).slice(0, 40)}…
              </option>
            ))}
          </select>
          <span>to reroll</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={cx(FIELD, 'py-1 text-xs')}>
            <option value="">a loot roll from this floor…</option>
            {targets
              .filter((t) => t.uid !== offer)
              .map((t) => (
                <option key={t.uid} value={t.uid}>
                  {itemName(t)}
                </option>
              ))}
          </select>
          <button
            type="button"
            className={SMALL_BUTTON}
            disabled={busy || !offer || !target}
            onClick={() => {
              act((s) => shrineOffering(s, offer, target, Math.random))
              setOffer('')
              setTarget('')
            }}
          >
            Make the offering
          </button>
        </div>
      )}
      {items.length > 0 ? (
        <ItemList>
          {items.map((i) => (
            <ItemLine key={i.uid} item={i}>
              {requestedBy(state, requests, i.uid).length > 0 && <WantedBy names={requestedBy(state, requests, i.uid)} />}
            </ItemLine>
          ))}
        </ItemList>
      ) : (
        <p className="m-0 text-xs text-stone-500">No items yet.</p>
      )}
    </Panel>
  )
}

/** The DM picks the kept items within the kept value and assigns each to a character. */
export function ExtractPanel({
  state,
  busy,
  act,
  requests,
  onClose,
}: {
  state: RunState
  busy: boolean
  act: Act
  requests: Record<string, string[]>
  onClose: () => void
}) {
  const items = useMemo(() => state.run.loot?.items ?? [], [state.run.loot])
  const firstRequester = (uid: string) => state.players.find((p) => requests[p.characterId]?.includes(uid))?.characterId
  const carrier = (uid: string) => firstRequester(uid) ?? state.players.find((pl) => pl.alive)?.characterId ?? state.players[0].characterId
  // Boss trophies always go home, so they start picked and can't be dropped.
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.filter(isFreeKeep).map((i) => [i.uid, carrier(i.uid)])),
  )
  const value = keptValue(state)
  const used = Object.keys(picks).reduce((s, uid) => {
    const item = items.find((i) => i.uid === uid)!
    return s + (isFreeKeep(item) ? 0 : itemValue(item))
  }, 0)
  const fullClear = isFullClear(state)
  const over = used > value
  const toggle = (uid: string) =>
    setPicks((p) => {
      const next = { ...p }
      if (next[uid]) delete next[uid]
      else next[uid] = carrier(uid)
      return next
    })
  const list: LootPick[] = Object.entries(picks).map(([uid, characterId]) => ({ uid, characterId }))
  return (
    <Panel
      hero
      tone="emerald"
      icon={<Coins size={16} />}
      title={fullClear ? 'Full clear: take everything home' : 'Extract: choose the loot to keep'}
      subtitle="Pick the items the party takes home and who carries each. Whatever value is left over is paid out in credits."
    >
      <SceneBanner id="extract" title={fullClear ? 'Full clear' : 'Extraction'} subtitle={`The party keeps ${keptPercent(state)}% of the haul`} />
      <StatStrip
        stats={[
          { label: 'Kept', value: `${keptPercent(state)}%`, tone: 'emerald' },
          { label: 'Kept value', value: credits(value), tone: 'emerald' },
          { label: 'Picked as items', value: credits(used), tone: over ? 'rose' : 'stone' },
          { label: 'Paid in credits', value: credits(Math.max(0, value - used)), tone: 'purple', hint: 'For you to hand out' },
        ]}
      />
      {over && (
        <p className="m-0 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <TriangleExclamationPoint size={14} /> That's over the kept value. Drop an item.
        </p>
      )}
      <ItemList>
        {items.map((i) => (
          <ItemLine key={i.uid} item={i}>
            {isFreeKeep(i) ? (
              <Pill tone="emerald">Trophy: free, always kept</Pill>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-stone-200">
                <input type="checkbox" checked={Boolean(picks[i.uid])} onChange={() => toggle(i.uid)} /> Keep
              </label>
            )}
            {picks[i.uid] && (
              <select
                value={picks[i.uid]}
                onChange={(e) => setPicks((p) => ({ ...p, [i.uid]: e.target.value }))}
                aria-label={`Who carries ${itemName(i)}`}
                className={cx(FIELD, 'py-1 text-xs')}
              >
                {state.players.map((p) => (
                  <option key={p.characterId} value={p.characterId}>
                    {p.name}
                    {p.alive ? '' : ' (fallen)'}
                  </option>
                ))}
              </select>
            )}
            <WantedBy names={requestedBy(state, requests, i.uid)} />
          </ItemLine>
        ))}
      </ItemList>
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmButton
          tone="emerald"
          disabled={busy || over || vaultPending(state)}
          confirmLabel={`Yes: ${list.length} item${list.length === 1 ? '' : 's'} + ${credits(value - used)}, end the run`}
          onConfirm={() => act((s) => extract(s, list))}
        >
          {fullClear ? 'Finish the full clear' : 'Extract'}
        </ConfirmButton>
        <button type="button" className={QUIET_BUTTON} disabled={busy} onClick={onClose}>
          Back
        </button>
      </div>
      {vaultPending(state) && <p className="m-0 text-[0.6875rem] text-amber-300">Every survivor takes a relic from Thils's Vault first.</p>}
    </Panel>
  )
}

/** Thils's Vault, DM side: everyone's offers, and taking one for a player. */
export function VaultPanel({ state, busy, act }: { state: RunState; busy: boolean; act: Act }) {
  if (!state.run.vaultOpen) return null
  return (
    <Panel tone="fuchsia" icon={<Gem size={15} />} title="Thils's Vault" subtitle="Players can pick on their own devices, or you can pick for them.">
      <SceneBanner id="thils-vault" title="Thils's Vault" subtitle="Each survivor drafts one relic." />
      {state.players
        .filter((p) => p.alive)
        .map((p) => (
          <div key={p.characterId} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <SectionLabel>{p.name}</SectionLabel>
              {p.vaultRelic && <Pill tone="emerald">Took {relicOf(p.vaultRelic).name}</Pill>}
            </div>
            {!p.vaultRelic && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {(p.vaultOffer ?? []).map((id) => (
                  <RelicCard key={id} id={id} partyLevel={state.run.partyLevel}>
                    <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={() => act((s) => chooseRelic(s, p.characterId, id))}>
                      Take for {p.name}
                    </button>
                  </RelicCard>
                ))}
              </div>
            )}
          </div>
        ))}
    </Panel>
  )
}

/** One relic offer: name, build, state and its text. */
function RelicCard({ id, partyLevel, children }: { id: string; partyLevel: number; children?: ReactNode }) {
  const r = relicOf(id)
  const woken = relicStateFor(partyLevel) === 'woken'
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-fuchsia-500/30 bg-stone-950/70 p-3">
      <strong className="text-sm text-fuchsia-100">{r.name}</strong>
      <div className="flex flex-wrap gap-1">
        <Pill>{r.build}</Pill>
        <Pill tone={woken ? 'amber' : 'stone'}>{woken ? 'Woken' : 'Dormant'}</Pill>
      </div>
      <p className="m-0 flex-1 text-[0.6875rem] text-stone-300">
        {r.dormant}
        {woken && ` Woken: ${r.woken}`}
      </p>
      {children && <div className="flex flex-wrap gap-1.5">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Players

export function PlayerLoot({ state, myCharacterIds, requests, readOnly = false }: {
  state: RunState
  myCharacterIds: string[]
  requests: Record<string, string[]>
  readOnly?: boolean
}) {
  const { run } = state
  const me = state.players.find((p) => myCharacterIds.includes(p.characterId) && p.alive) ?? null
  const mine = me ? (requests[me.characterId] ?? []) : []
  const [sending, setSending] = useState(false)
  const items = run.loot?.items ?? []

  async function toggle(uid: string) {
    if (!me || readOnly) return
    setSending(true)
    const next = mine.includes(uid) ? mine.filter((u) => u !== uid) : [...mine, uid]
    await setLootRequests(run.id, me.characterId, next).finally(() => setSending(false))
  }

  async function takeRelic(relicId: string) {
    if (!me || readOnly) return
    setSending(true)
    await submitChoice(run.id, me.characterId, { action: 'relic', relicId }, null).finally(() => setSending(false))
  }

  return (
    <>
      {run.vaultOpen && me && (
        <Panel tone="fuchsia" icon={<Gem size={15} />} title="Thils's Vault">
          <SceneBanner id="thils-vault" title="Thils's Vault" subtitle="Take one relic." />
          {me.vaultRelic ? (
            <p className="m-0 text-sm text-emerald-300">You took {relicOf(me.vaultRelic).name}.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {(me.vaultOffer ?? []).map((id) => (
                <RelicCard key={id} id={id} partyLevel={run.partyLevel}>
                  <button type="button" className={PRIMARY_BUTTON} disabled={readOnly || sending} onClick={() => takeRelic(id)}>
                    Take this relic
                  </button>
                </RelicCard>
              ))}
            </div>
          )}
        </Panel>
      )}
      <Panel tone="purple" icon={<Package size={15} />} title="Party loot">
        <PoolSummary state={state} />
        {items.length > 0 ? (
          <ItemList>
            {items.map((i) => (
              <ItemLine key={i.uid} item={i}>
                {me && (
                  <button
                    type="button"
                    className={cx(SMALL_BUTTON, mine.includes(i.uid) && 'border-sky-500/40 bg-sky-500/20 text-sky-200')}
                    aria-pressed={mine.includes(i.uid)}
                    disabled={readOnly || sending}
                    onClick={() => toggle(i.uid)}
                  >
                    {mine.includes(i.uid) ? 'Requested (undo)' : 'Request'}
                  </button>
                )}
                <WantedBy names={requestedBy(state, requests, i.uid)} />
              </ItemLine>
            ))}
          </ItemList>
        ) : (
          <p className="m-0 text-xs text-stone-500">No items yet.</p>
        )}
        {me && items.length > 0 && (
          <p className="m-0 text-[0.6875rem] text-stone-500">Requests tell the DM what you'd like; the party decides at extraction.</p>
        )}
      </Panel>
    </>
  )
}

// ---------------------------------------------------------------------------
// Characters

export function CharacterLoot({ loot }: { loot: OwnedLoot[] | undefined }) {
  if (!loot?.length) return null
  return (
    <details className="rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
      <summary className="cursor-pointer text-xs font-semibold text-stone-200">Loot carried out ({loot.length})</summary>
      <div className="mt-2">
        <ItemList>
          {loot.map((i) => (
            <ItemLine key={`${i.runId}-${i.uid}`} item={i} />
          ))}
        </ItemList>
      </div>
    </details>
  )
}
