// The Basalt Markets: buy permanent upgrades with a character's banked Quantum Basalts.
import { useState } from 'react'
import type { Character } from '../model/character'
import { changeUpgrade } from '../characterStore'
import { nextRankCost, ownedRankCost, upgradesFor, type UpgradeScope } from '../rules/upgrades'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Pill } from '../ui/Pill'
import { cx } from '../ui/tone'

const SCOPE_LABELS: Record<UpgradeScope, string> = {
  personal: 'Just this character',
  'party-per-owner': 'Whole party; each owner adds more',
  'party-highest': 'Whole party; highest rank applies',
}

interface Props {
  character: Character
  /** Players can't refund; the database rules refuse it anyway. */
  canCorrect?: boolean
  /** False for the DM's read-only "view as player" preview. */
  canSpend?: boolean
}

export function UpgradeShop({ character, canCorrect = true, canSpend = true }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const banked = character.bankedQuantumBasalts

  async function change(upgradeId: string, mode: 'buy' | 'refund') {
    setError(null)
    setBusy(true)
    try {
      await changeUpgrade(character.id, upgradeId, mode)
    } catch (err) {
      setError((err as Error).message || 'Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone="purple" mono>
          {banked} Quantum Basalts available
        </Pill>
        {busy && <span className="text-[0.6875rem] text-stone-400">Saving…</span>}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {upgradesFor(character).map((u) => {
          const owned = character.upgrades[u.id] ?? 0
          const cost = nextRankCost(u.id, owned)
          const maxed = cost === null
          return (
            <div
              key={u.id}
              className={cx('flex flex-col gap-2 rounded-xl border bg-stone-950/70 p-3', owned > 0 ? 'border-amber-500/40' : 'border-stone-800')}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <strong className="mr-auto text-sm text-stone-100">{u.name}</strong>
                <Pill tone={owned > 0 ? 'amber' : 'stone'} mono>
                  {owned} / {u.costs.length}
                </Pill>
              </div>
              {(u.status === 'proposed' || u.requiresFullClear) && (
                <div className="flex flex-wrap gap-1.5">
                  {u.requiresFullClear && <Pill tone="amber">Full clear reward</Pill>}
                  {u.status === 'proposed' && <Pill>Proposed</Pill>}
                </div>
              )}
              <p className="m-0 flex-1 text-[0.6875rem] text-stone-300">{u.effect}</p>
              <p className="m-0 text-[0.625rem] text-stone-500">
                {SCOPE_LABELS[u.scope]} · costs {u.costs.join(', ')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {maxed ? (
                  <Pill tone="emerald">Maxed</Pill>
                ) : (
                  <ConfirmButton
                    tone="amber"
                    disabled={!canSpend || busy || cost > banked}
                    confirmLabel={`Yes, buy rank ${owned + 1} for ${cost} QB`}
                    onConfirm={() => change(u.id, 'buy')}
                  >
                    Buy rank {owned + 1} ({cost} QB)
                  </ConfirmButton>
                )}
                {canCorrect && owned > 0 && (
                  <ConfirmButton
                    disabled={busy}
                    confirmLabel={`Yes, refund ${ownedRankCost(u.id, owned)} QB`}
                    onConfirm={() => change(u.id, 'refund')}
                  >
                    Refund
                  </ConfirmButton>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="m-0 text-[0.6875rem] text-white">
        Upgrades bought during a run take effect from the next run.
        {canCorrect ? ' Refund undoes the last rank bought, to correct mistakes.' : ' Purchases are permanent; ask your DM if you make a mistake.'}
      </p>
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  )
}
