// Loot screens: the party's pool (DM and players), strider remains and shrine
// offerings, the extraction share, Thils's Vault, and characters' own loot.
// Run loot is shared party information, so players see the whole pool.
import { useMemo, useState, type ReactNode } from 'react'
import type { OwnedLoot } from '../model/character'
import type { RunState } from '../model/run'
import {
  itemName,
  itemText,
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
} from '../rules/loot'
import { canExtract, extract, isFullClear } from '../rules/runFlow'
import { chooseRelic, relicStateFor, vaultPending } from '../rules/vault'
import { SceneBanner } from './Scene'
import { setLootRequests, submitChoice } from '../runStore'

type Act = (step: (s: RunState) => RunState, confirmText?: string) => void
const credits = (n: number) => `${n.toLocaleString()} cr`

function ItemLine({ item, children }: { item: LootItem; children?: ReactNode }) {
  return (
    <li className="loot-item">
      <div>
        <strong>{itemName(item)}</strong>{' '}
        <span className="hint">
          {item.kind === 'trinket' ? 'trinket' : item.kind === 'relic' ? `relic, ${item.relicState}` : `${rarityName(item.rarity ?? 'common')} ${item.kind}`}
          {item.kind !== 'relic' && ` · ${credits(itemValue(item))}`} · floor {item.floor}
        </span>{' '}
        {children}
      </div>
      <div className="hint">{itemText(item)}</div>
    </li>
  )
}

function PoolSummary({ state }: { state: RunState }) {
  const loot = state.run.loot
  return (
    <p className="hint">
      Pool worth {credits(poolValue(loot))} ({credits(loot?.credits ?? 0)} in credits
      {loot?.items.length ? ` and ${loot.items.length} item${loot.items.length === 1 ? '' : 's'}` : ''}).{' '}
      {canExtract(state)
        ? `Extracting now keeps ${keptPercent(state)}%: ${credits(keptValue(state))}.`
        : 'Extraction opens after a boss.'}
    </p>
  )
}

/** Names of players who asked for an item. */
function requestedBy(state: RunState, requests: Record<string, string[]>, uid: string): string[] {
  return state.players.filter((p) => requests[p.characterId]?.includes(uid)).map((p) => p.name)
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
    <div className="room-stage loot-panel">
      <h3>Run loot</h3>
      <PoolSummary state={state} />
      {terrain.includes('strider-remains') && !run.awaitingChoice && (
        <p>
          Strider remains: Investigation DC {striderSearchDC(run.floor)}.{' '}
          {searched ? (
            <span className="tag shown">searched</span>
          ) : (
            <>
              <button type="button" className="quiet" disabled={busy} onClick={() => act((s) => searchStriderRemains(s, false, Math.random))}>
                Found a trinket
              </button>{' '}
              <button type="button" className="quiet" disabled={busy} onClick={() => act((s) => searchStriderRemains(s, true, Math.random))}>
                Beat it by 5: trinket and consumable
              </button>
            </>
          )}
        </p>
      )}
      {terrain.includes('shrine-to-thils') && trinkets.length > 0 && targets.length > 0 && (
        <p className="row-actions wrap">
          Shrine to Thils: offer{' '}
          <select value={offer} onChange={(e) => setOffer(e.target.value)}>
            <option value="">a trinket…</option>
            {trinkets.map((t) => (
              <option key={t.uid} value={t.uid}>
                {itemText(t).slice(0, 40)}…
              </option>
            ))}
          </select>{' '}
          to reroll{' '}
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">a loot roll from this floor…</option>
            {targets
              .filter((t) => t.uid !== offer)
              .map((t) => (
                <option key={t.uid} value={t.uid}>
                  {itemName(t)}
                </option>
              ))}
          </select>{' '}
          <button
            type="button"
            disabled={busy || !offer || !target}
            onClick={() => {
              act((s) => shrineOffering(s, offer, target, Math.random))
              setOffer('')
              setTarget('')
            }}
          >
            Make the offering
          </button>
        </p>
      )}
      {items.length > 0 ? (
        <ul className="plain-list">
          {items.map((i) => {
            const wanted = requestedBy(state, requests, i.uid)
            return (
              <ItemLine key={i.uid} item={i}>
                {wanted.length > 0 && <span className="tag">wanted by {wanted.join(', ')}</span>}
              </ItemLine>
            )
          })}
        </ul>
      ) : (
        <p className="hint">No items yet.</p>
      )}
    </div>
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
  const [picks, setPicks] = useState<Record<string, string>>({})
  const value = keptValue(state)
  const used = Object.keys(picks).reduce((s, uid) => s + itemValue(items.find((i) => i.uid === uid)!), 0)
  const fullClear = isFullClear(state)
  const toggle = (uid: string) =>
    setPicks((p) => {
      const next = { ...p }
      if (next[uid]) delete next[uid]
      else next[uid] = firstRequester(uid) ?? state.players.find((pl) => pl.alive)?.characterId ?? state.players[0].characterId
      return next
    })
  const list: LootPick[] = Object.entries(picks).map(([uid, characterId]) => ({ uid, characterId }))
  return (
    <div className="room-stage extract-panel">
      <h3>{fullClear ? 'Full clear: take everything home' : 'Extract: choose the loot to keep'}</h3>
      <p>
        The party keeps {keptPercent(state)}%: <strong>{credits(value)}</strong>. Picked {credits(used)}; the other{' '}
        <strong>{credits(Math.max(0, value - used))}</strong> is paid out in credits for you to hand out.
      </p>
      {used > value && <p className="warning">That's over the kept value. Drop an item.</p>}
      <ul className="plain-list">
        {items.map((i) => (
          <ItemLine key={i.uid} item={i}>
            <label>
              <input type="checkbox" checked={Boolean(picks[i.uid])} onChange={() => toggle(i.uid)} /> keep
            </label>{' '}
            {picks[i.uid] && (
              <select value={picks[i.uid]} onChange={(e) => setPicks((p) => ({ ...p, [i.uid]: e.target.value }))}>
                {state.players.map((p) => (
                  <option key={p.characterId} value={p.characterId}>
                    {p.name}
                    {p.alive ? '' : ' (fallen)'}
                  </option>
                ))}
              </select>
            )}{' '}
            {requestedBy(state, requests, i.uid).length > 0 && (
              <span className="tag">wanted by {requestedBy(state, requests, i.uid).join(', ')}</span>
            )}
          </ItemLine>
        ))}
      </ul>
      <div className="form-actions">
        <button
          type="button"
          disabled={busy || used > value || vaultPending(state)}
          onClick={() =>
            act((s) => extract(s, list), `Extract now? ${list.length} item(s) go home, plus ${credits(value - used)} in credits, and the run ends.`)
          }
        >
          {fullClear ? 'Finish the full clear' : 'Extract'}
        </button>
        <button type="button" className="quiet" disabled={busy} onClick={onClose}>
          Back
        </button>
      </div>
      {vaultPending(state) && <p className="hint">Every survivor takes a relic from Thils's Vault first.</p>}
    </div>
  )
}

/** Thils's Vault, DM side: everyone's offers, and taking one for a player. */
export function VaultPanel({ state, busy, act }: { state: RunState; busy: boolean; act: Act }) {
  if (!state.run.vaultOpen) return null
  return (
    <div className="room-stage vault-panel">
      <SceneBanner id="thils-vault" title="Thils's Vault" subtitle="Each survivor drafts one relic." />
      <p className="hint">Players can pick on their own devices, or you can pick for them.</p>
      {state.players
        .filter((p) => p.alive)
        .map((p) => (
          <div key={p.characterId}>
            <strong>{p.name}</strong>:{' '}
            {p.vaultRelic ? (
              <span className="tag shown">took {relicOf(p.vaultRelic).name}</span>
            ) : (
              <ul className="plain-list">
                {(p.vaultOffer ?? []).map((id) => (
                  <li key={id}>
                    <RelicText id={id} partyLevel={state.run.partyLevel} />{' '}
                    <button type="button" className="quiet" disabled={busy} onClick={() => act((s) => chooseRelic(s, p.characterId, id))}>
                      Take for {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
    </div>
  )
}

function RelicText({ id, partyLevel }: { id: string; partyLevel: number }) {
  const r = relicOf(id)
  const woken = relicStateFor(partyLevel) === 'woken'
  return (
    <>
      <strong>{r.name}</strong> <span className="hint">({r.build}, {woken ? 'Woken' : 'Dormant'})</span>
      <div className="hint">
        {r.dormant}
        {woken && ` Woken: ${r.woken}`}
      </div>
    </>
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
    <div className="room-stage loot-panel">
      {run.vaultOpen && me && (
        <div className="vault-panel">
          <SceneBanner id="thils-vault" title="Thils's Vault" subtitle="Take one relic." />
          {me.vaultRelic ? (
            <p className="notice">You took {relicOf(me.vaultRelic).name}.</p>
          ) : (
            <ul className="plain-list">
              {(me.vaultOffer ?? []).map((id) => (
                <li key={id}>
                  <RelicText id={id} partyLevel={run.partyLevel} />{' '}
                  <button type="button" disabled={readOnly || sending} onClick={() => takeRelic(id)}>
                    Take this relic
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <h3>Party loot</h3>
      <PoolSummary state={state} />
      {items.length > 0 ? (
        <ul className="plain-list">
          {items.map((i) => (
            <ItemLine key={i.uid} item={i}>
              {me && (
                <button type="button" className="quiet" disabled={readOnly || sending} onClick={() => toggle(i.uid)}>
                  {mine.includes(i.uid) ? 'Requested (undo)' : 'Request'}
                </button>
              )}
              {requestedBy(state, requests, i.uid).length > 0 && (
                <span className="tag">wanted by {requestedBy(state, requests, i.uid).join(', ')}</span>
              )}
            </ItemLine>
          ))}
        </ul>
      ) : (
        <p className="hint">No items yet.</p>
      )}
      {me && items.length > 0 && <p className="hint">Requests tell the DM what you'd like; the party decides at extraction.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Characters

export function CharacterLoot({ loot }: { loot: OwnedLoot[] | undefined }) {
  if (!loot?.length) return null
  return (
    <details className="character-loot">
      <summary>Loot carried out ({loot.length})</summary>
      <ul className="plain-list">
        {loot.map((i) => (
          <ItemLine key={`${i.runId}-${i.uid}`} item={i} />
        ))}
      </ul>
    </details>
  )
}
