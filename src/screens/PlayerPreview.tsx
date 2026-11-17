// DM tool: see the app exactly as one of your players does, read-only.
import { useState } from 'react'
import { Eye } from 'lucide-react'
import type { Character } from '../model/character'
import { useCharacters } from '../useCharacters'
import { Avatar } from './LookPicker'
import { portraitHonors } from '../rules/portraitHonors'
import { PlayerHome } from './PlayerHome'
import { Panel } from '../ui/Panel'
import { SMALL_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'

export function PlayerPreview() {
  const { characters } = useCharacters()
  const [email, setEmail] = useState('')

  const byEmail = new Map<string, Character[]>()
  for (const c of characters ?? []) {
    if (!c.playerEmail) continue
    const list = byEmail.get(c.playerEmail)
    if (list) list.push(c)
    else byEmail.set(c.playerEmail, [c])
  }
  const players = [...byEmail.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  return (
    <div className="mt-6 flex flex-col gap-2">
      <Panel
        tone="sky"
        icon={<Eye size={15} />}
        title="View as player"
        subtitle={email ? `Preview of ${email}'s screen. Spending is off here, but you can make their draft picks.` : 'Pick a player to see their screen.'}
        actions={
          email ? (
            <button type="button" className={SMALL_BUTTON} onClick={() => setEmail('')}>
              Pick another player
            </button>
          ) : undefined
        }
      >
        {!email &&
          (players.length === 0 ? (
            <p className="m-0 text-xs text-stone-400">Set a player email on a character to preview what that player sees.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {players.map(([playerEmail, chars]) => (
                <button
                  key={playerEmail}
                  type="button"
                  aria-label={`Preview ${playerEmail}'s screen`}
                  onClick={() => setEmail(playerEmail)}
                  className={cx(
                    WELL,
                    'flex w-full cursor-pointer flex-col justify-between gap-2 text-left transition-colors hover:border-sky-500/50 hover:bg-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60',
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-2">
                    {chars.map((c) => (
                      <span key={c.id} className="flex min-w-0 items-center gap-2.5">
                        <Avatar portrait={c.portrait} name={c.name} size="h-9 w-9" honors={portraitHonors(c)} />
                        <span className="min-w-0 truncate text-sm font-semibold text-stone-100">{c.name}</span>
                      </span>
                    ))}
                  </span>
                  <span className="w-full truncate text-xs text-stone-400">{playerEmail}</span>
                </button>
              ))}
            </div>
          ))}
      </Panel>
      {email && <PlayerHome email={email} readOnly />}
    </div>
  )
}
