// Descend or extract, after a boss: players vote on their devices
// (ExitVoteButtons) and the DM sees the tally (ExitVoteTally). The DM still
// makes the call with the Descend and Extract buttons.
import type { ReactNode } from 'react'
import { ArrowDownToLine, LogOut, Vote } from 'lucide-react'
import type { RunPlayer, RunState } from '../model/run'
import { tallyVotes, votingOpen, type ExitVote, type ExitVoteDoc } from '../rules/votes'
import type { ExitBallot } from './useExitVote'
import { Pill } from '../ui/Pill'
import { SMALL_BUTTON } from '../ui/styles'
import { cx, toneClasses } from '../ui/tone'

/** The party's votes for the DM (and players): who chose what, and who hasn't voted. */
export function ExitVoteTally({ state, votes }: { state: RunState; votes: Record<string, ExitVoteDoc> }) {
  if (!votingOpen(state)) return null
  const t = tallyVotes(state, votes)
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
      <Vote size={14} />
      <strong className="mr-1">Party vote</strong>
      <Pill tone="indigo">
        Descend {t.descend.length}
        {t.descend.length > 0 && `: ${t.descend.join(', ')}`}
      </Pill>
      <Pill tone="sky">
        Extract {t.extract.length}
        {t.extract.length > 0 && `: ${t.extract.join(', ')}`}
      </Pill>
      {t.waiting.length > 0 && <span className="text-stone-400">Not voted: {t.waiting.join(', ')}</span>}
    </div>
  )
}

/** Per-character vote buttons (when controlling 2+ living characters), change note, and errors. */
export function ExitVoteButtons({
  state,
  mine,
  votes,
  readOnly,
  ballot,
}: {
  state: RunState
  mine: RunPlayer[]
  votes: Record<string, ExitVoteDoc>
  readOnly: boolean
  ballot: ExitBallot
}) {
  if (!votingOpen(state)) return null
  const { run } = state
  const living = mine.filter((p) => p.alive)
  const showRows = living.length >= 2
  if (!showRows && !ballot.current && !ballot.error) return null

  return (
    <div className="flex flex-col gap-2">
      {showRows &&
        living.map((p) => {
          const v = votes[p.characterId]
          const charVote = v && v.floor === run.floor ? v.vote : null
          const button = (vote: ExitVote, label: string, icon: ReactNode, tone: 'indigo' | 'sky') => (
            <button
              type="button"
              aria-pressed={charVote === vote}
              disabled={readOnly || ballot.sending}
              onClick={() => ballot.castOne(p.characterId, vote)}
              className={cx(SMALL_BUTTON, charVote === vote ? toneClasses[tone].button : 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800')}
            >
              {icon} {label}
            </button>
          )
          return (
            <div key={p.characterId} className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-stone-200">{p.name}</span>
              {button('descend', 'Descend', <ArrowDownToLine size={12} />, 'indigo')}
              {button('extract', 'Extract', <LogOut size={12} />, 'sky')}
            </div>
          )
        })}
      {ballot.current && <p className="m-0 text-[0.6875rem] text-stone-400">You can change your vote until the DM decides.</p>}
      {ballot.error && <p className="m-0 text-xs text-rose-300">{ballot.error}</p>}
    </div>
  )
}
