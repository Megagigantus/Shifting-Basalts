// Buy permanent upgrades with a character's banked Quantum Basalts.
import { useState } from 'react'
import type { Character } from '../model/character'
import { changeUpgrade } from '../characterStore'
import { nextRankCost, ownedRankCost, UPGRADES, type UpgradeScope } from '../rules/upgrades'

const SCOPE_LABELS: Record<UpgradeScope, string> = {
  personal: 'Just this character',
  'party-per-owner': 'Whole party; each owner adds more',
  'party-highest': 'Whole party; highest rank applies',
}

export function UpgradeShop({ character, onClose }: { character: Character; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const banked = character.bankedQuantumBasalts

  async function change(upgradeId: string, mode: 'buy' | 'refund') {
    const upgrade = UPGRADES.find((u) => u.id === upgradeId)!
    const owned = character.upgrades[upgradeId] ?? 0
    const text =
      mode === 'buy'
        ? `Buy ${upgrade.name} rank ${owned + 1} for ${nextRankCost(upgradeId, owned)} Quantum Basalts?`
        : `Refund ${upgrade.name} rank ${owned}? ${character.name} gets ${ownedRankCost(upgradeId, owned)} Quantum Basalts back. Use this to correct mistakes.`
    if (!window.confirm(text)) return
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
    <div className="stat-tracks">
      <div className="panel-header">
        <h3>{character.name}: upgrades</h3>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p>
        <strong>{banked}</strong> Quantum Basalts banked
        {busy && <span className="hint"> · Saving…</span>}
      </p>

      <table className="party-table">
        <thead>
          <tr>
            <th>Upgrade</th>
            <th>Rank</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {UPGRADES.map((u) => {
            const owned = character.upgrades[u.id] ?? 0
            const cost = nextRankCost(u.id, owned)
            return (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  {u.status === 'proposed' && <span className="hint"> (proposed)</span>}
                  <div className="hint">{u.effect}</div>
                  <div className="hint">{SCOPE_LABELS[u.scope]}</div>
                </td>
                <td>
                  {owned} / {u.costs.length}
                  <div className="hint">costs {u.costs.join(', ')}</div>
                </td>
                <td className="row-actions">
                  {cost !== null ? (
                    <button type="button" disabled={busy || cost > banked} onClick={() => change(u.id, 'buy')}>
                      Buy ({cost})
                    </button>
                  ) : (
                    <span className="hint">Maxed</span>
                  )}
                  <button
                    type="button"
                    className="quiet"
                    disabled={busy || owned === 0}
                    onClick={() => change(u.id, 'refund')}
                    title="Correction: undo the last rank bought and return its cost"
                  >
                    Refund
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="hint">
        Upgrades bought during a run take effect from the next run. Refund is for correcting mistakes.
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
