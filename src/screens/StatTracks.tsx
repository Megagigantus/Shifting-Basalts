// Spend a character's banked Devotions on stat tracks.
import { useState } from 'react'
import type { Character } from '../model/character'
import { investDevotions } from '../characterStore'
import {
  devotionsForRank,
  effectAtRank,
  investmentCap,
  MAX_RANK,
  rankProgress,
  STAT_TRACKS,
  tierCap,
} from '../rules/statTracks'

export function StatTracks({ character, onClose }: { character: Character; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cap = tierCap(character.level)
  const capDevotions = investmentCap(character.level)
  const banked = character.bankedDevotions

  async function invest(trackId: string, amount: number) {
    setError(null)
    setBusy(true)
    try {
      await investDevotions(character.id, trackId, amount)
    } catch (err) {
      setError((err as Error).message || 'Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stat-tracks">
      <div className="panel-header">
        <h3>{character.name}: stat tracks</h3>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <p>
        <strong>{banked}</strong> Devotions banked · tier cap rank {cap} at level {character.level}
        {cap < MAX_RANK && <span className="hint"> (rises at the next tier of play)</span>}
        {busy && <span className="hint"> · Saving…</span>}
      </p>

      <table className="party-table">
        <thead>
          <tr>
            <th>Track</th>
            <th>Rank</th>
            <th>Effect</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {STAT_TRACKS.map((track) => {
            const invested = character.trackDevotions[track.id] ?? 0
            const { rank, towardNext, nextCost } = rankProgress(invested)
            const roomLeft = capDevotions - invested
            const toFinish = nextCost === null ? 0 : nextCost - towardNext
            const atCap = roomLeft <= 0
            return (
              <tr key={track.id}>
                <td>
                  {track.name}
                  <div className="hint">{track.perRank}</div>
                  {track.id === 'spell-slot-recovery' && character.casterType === 'none' && (
                    <div className="warning">This character has no spell slots.</div>
                  )}
                </td>
                <td>
                  {rank}
                  <div className="hint">
                    {atCap
                      ? 'at tier cap'
                      : nextCost !== null && `${towardNext}/${nextCost} toward rank ${rank + 1}`}
                  </div>
                </td>
                <td>{effectAtRank(track, rank) ?? <span className="hint">none yet</span>}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    disabled={busy || banked < 1 || atCap}
                    onClick={() => invest(track.id, 1)}
                    title="Invest 1 Devotion"
                  >
                    +1
                  </button>
                  {toFinish > 1 && (
                    <button
                      type="button"
                      disabled={busy || banked < toFinish || toFinish > roomLeft}
                      onClick={() => invest(track.id, toFinish)}
                      title={`Invest ${toFinish} Devotions to reach rank ${rank + 1}`}
                    >
                      Finish rank (+{toFinish})
                    </button>
                  )}
                  <button
                    type="button"
                    className="quiet"
                    disabled={busy || invested === 0}
                    onClick={() => invest(track.id, -1)}
                    title="Correction: take 1 Devotion back out of this track"
                  >
                    −1
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="hint">
        Maxing a track takes {devotionsForRank(MAX_RANK)} Devotions. −1 is for correcting mistakes and
        refunds the Devotion to the bank.
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
