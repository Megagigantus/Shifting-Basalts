// The Basalt Shrine: spend a character's banked Devotions on stat tracks.
import { useState } from 'react'
import type { Character } from '../model/character'
import { investDevotions } from '../characterStore'
import {
  devotionsForRank,
  effectAtRank,
  investmentCap,
  MAX_RANK,
  rankProgress,
  RANK_COSTS,
  STAT_TRACKS,
  tierCap,
} from '../rules/statTracks'
import { Pill } from '../ui/Pill'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

interface Props {
  character: Character
  /** Players can't use the −1 correction; the database rules refuse it anyway. */
  canCorrect?: boolean
  /** False for the DM's read-only "view as player" preview. */
  canSpend?: boolean
}

export function StatTracks({ character, canCorrect = true, canSpend = true }: Props) {
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone="indigo" mono>
          {banked} Devotions available
        </Pill>
        <Pill>
          Tier cap: rank {cap} at level {character.level}
        </Pill>
        {cap < MAX_RANK && <span className="text-[0.6875rem] text-white">Rises at the next tier of play.</span>}
        {busy && <span className="text-[0.6875rem] text-stone-400">Saving…</span>}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {STAT_TRACKS.map((track) => {
          const invested = character.trackDevotions[track.id] ?? 0
          const { rank, towardNext, nextCost } = rankProgress(invested)
          const roomLeft = capDevotions - invested
          const toFinish = nextCost === null ? 0 : nextCost - towardNext
          const atCap = roomLeft <= 0
          const effect = effectAtRank(track, rank)
          const pct = nextCost ? (towardNext / nextCost) * 100 : 100
          return (
            <div key={track.id} className="flex flex-col gap-2 rounded-xl border border-indigo-500/25 bg-stone-950/70 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <strong className="mr-auto text-sm text-stone-100">{track.name}</strong>
                <Pill tone="indigo" mono>
                  Rank {rank}
                </Pill>
              </div>
              <p className="m-0 text-[0.6875rem] text-stone-400">{track.perRank}</p>
              <div className="flex items-center gap-2">
                <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-stone-800" aria-hidden="true">
                  <span className={cx('block h-full rounded-full', atCap ? 'bg-stone-500' : 'bg-indigo-400')} style={{ width: `${pct}%` }} />
                </span>
                <span className="font-mono text-[0.625rem] text-stone-400">
                  {atCap ? 'at tier cap' : nextCost !== null ? `${towardNext}/${nextCost} to rank ${rank + 1}` : 'max'}
                </span>
              </div>
              <p className="m-0 text-xs text-emerald-200">{effect ?? <span className="text-stone-500">No effect yet</span>}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={cx(SMALL_BUTTON, 'text-indigo-200')}
                  disabled={!canSpend || busy || banked < 1 || atCap}
                  onClick={() => invest(track.id, 1)}
                  title="Invest 1 Devotion"
                >
                  +1 Devotion
                </button>
                {toFinish > 1 && (
                  <button
                    type="button"
                    className={cx(SMALL_BUTTON, 'text-indigo-200')}
                    disabled={!canSpend || busy || banked < toFinish || toFinish > roomLeft}
                    onClick={() => invest(track.id, toFinish)}
                    title={`Invest ${toFinish} Devotions to reach rank ${rank + 1}`}
                  >
                    Finish rank (+{toFinish})
                  </button>
                )}
                {canCorrect && (
                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    disabled={busy || invested === 0}
                    onClick={() => invest(track.id, -1)}
                    title="Correction: take 1 Devotion back out of this track"
                  >
                    −1
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <p className="m-0 text-[0.6875rem] text-white">
        {RANK_COSTS.map((b) => `Ranks ${b.fromRank} to ${b.toRank} cost ${b.devotions} each`).join(', ')}. Maxing a track takes {devotionsForRank(MAX_RANK)} Devotions.
        {canCorrect && ' −1 is for correcting mistakes and refunds the Devotion to the bank.'}
        {!canCorrect && ' Spent Devotions are permanent; ask your DM if you make a mistake.'}
      </p>
      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  )
}
