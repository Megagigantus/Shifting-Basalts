// The Reclamation Shrine in a post-boss room (rules/shrine.ts). Players
// pledge their own unbanked boss Basalts toward bringing back a fallen ally;
// the DM sees the pledges and reclaims once they cover the cost.
import { useState } from 'react'
import { HeartHandshake } from 'lucide-react'
import type { RunPlayer, RunState } from '../model/run'
import { pledgedTotal, pledgesFor, reclaimable, shrineCost, shrineHere, type Pledge } from '../rules/shrine'
import { reclaimAlly, setPledge, usePledges } from '../runStore'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Pill } from '../ui/Pill'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

interface Props {
  state: RunState
  /** The DM's screen: shows the Reclaim button. */
  forDm?: boolean
  /** The player's own living characters, who can pledge. */
  mine?: RunPlayer[]
  readOnly?: boolean
}

export function ShrinePanel({ state, forDm = false, mine = [], readOnly = false }: Props) {
  const pledges = usePledges(state.run.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!shrineHere(state)) return null
  const fallen = reclaimable(state)
  const cost = shrineCost(state)
  const { run } = state

  async function attempt(task: () => Promise<void>, failure: string) {
    setError(null)
    setBusy(true)
    try {
      await task()
    } catch (err) {
      setError((err as Error).message || failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <HeartHandshake size={14} className="text-amber-300" />
        <strong className="mr-auto text-sm text-amber-100">The Reclamation Shrine</strong>
        <Pill tone="amber" mono>
          {cost} Quantum Basalts per ally
        </Pill>
      </div>
      <p className="m-0 text-[0.6875rem] text-stone-300">
        Bring back an ally expelled on this floor, with their boons, no lockout and their run Basalts restored. Paid from living players'
        boss Basalts earned this run, pooled from anyone.
      </p>
      {fallen.length === 0 && <p className="m-0 text-[0.6875rem] text-stone-500">Nobody was lost on this floor.</p>}
      {fallen.map((ally) => {
        const total = pledgedTotal(state, pledges, ally.characterId)
        const from = pledgesFor(state, pledges, ally.characterId)
        return (
          <div key={ally.characterId} className="flex flex-col gap-2 rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <strong className="mr-auto text-xs text-stone-100">{ally.name}</strong>
              <Pill tone={total >= cost ? 'emerald' : 'stone'} mono>
                Pledged {Math.min(total, cost)} / {cost}
              </Pill>
            </div>
            {from.length > 0 && (
              <p className="m-0 text-[0.6875rem] text-stone-400">{from.map((x) => `${x.name} ${x.amount}`).join(' · ')}</p>
            )}
            {mine
              .filter((p) => p.alive)
              .map((p) => (
                <PledgeRow
                  key={p.characterId}
                  player={p}
                  ally={ally}
                  current={pledges[p.characterId]}
                  floor={run.floor}
                  disabled={readOnly || busy}
                  onPledge={(amount) =>
                    attempt(() => setPledge(run.id, p.characterId, { targetId: ally.characterId, amount, floor: run.floor }), 'Could not send your pledge.')
                  }
                />
              ))}
            {forDm && (
              <ConfirmButton
                tone="amber"
                disabled={busy || total < cost}
                confirmLabel={`Yes, reclaim ${ally.name} for ${cost} Quantum Basalts`}
                onConfirm={() => attempt(() => reclaimAlly(state, ally.characterId, pledges), 'Could not reclaim. Check your connection.')}
              >
                {total >= cost ? `Reclaim ${ally.name}` : `Waiting on ${cost - total} Quantum Basalts of pledges`}
              </ConfirmButton>
            )}
          </div>
        )
      })}
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  )
}

/** One of the player's characters pledging toward one fallen ally. */
function PledgeRow({
  player,
  ally,
  current,
  floor,
  disabled,
  onPledge,
}: {
  player: RunPlayer
  ally: RunPlayer
  current: Pledge | undefined
  floor: number
  disabled: boolean
  onPledge: (amount: number) => void
}) {
  const pledgedHere = current && current.targetId === ally.characterId && current.floor === floor ? current.amount : 0
  const elsewhere = current && current.floor === floor && current.targetId !== ally.characterId && current.amount > 0
  const [amount, setAmount] = useState(String(pledgedHere || ''))
  const value = Math.max(0, Math.floor(Number(amount) || 0))
  const max = player.quantumBasaltsEarned
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-stone-300">
      <span className="mr-1">
        {player.name} ({max} run Quantum Basalts){pledgedHere > 0 && `: pledged ${pledgedHere}`}
      </span>
      <input
        type="number"
        min={0}
        max={max}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={disabled || max === 0}
        aria-label={`${player.name}'s pledge toward ${ally.name}`}
        className="w-16 rounded-md border border-stone-700 bg-stone-900 px-1.5 py-1 font-mono text-xs text-stone-100"
      />
      <button
        type="button"
        disabled={disabled || value === 0 || value > max}
        onClick={() => onPledge(value)}
        className={cx(SMALL_BUTTON, 'border-amber-500/40 bg-amber-500/20 text-amber-200')}
      >
        Pledge
      </button>
      {pledgedHere > 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAmount('')
            onPledge(0)
          }}
          className={SMALL_BUTTON}
        >
          Withdraw
        </button>
      )}
      {elsewhere && <span className="text-stone-500">Pledging here replaces your pledge to another ally.</span>}
      {value > max && <span className="text-rose-300">You have {max} to give.</span>}
    </div>
  )
}
