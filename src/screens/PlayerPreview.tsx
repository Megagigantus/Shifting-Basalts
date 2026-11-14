// DM tool: see the app exactly as one of your players does, read-only.
import { useState } from 'react'
import { Eye } from 'lucide-react'
import { useCharacters } from '../useCharacters'
import { PlayerHome } from './PlayerHome'
import { Panel } from '../ui/Panel'
import { FIELD } from '../ui/styles'

export function PlayerPreview() {
  const { characters } = useCharacters()
  const [email, setEmail] = useState('')
  const emails = [...new Set((characters ?? []).map((c) => c.playerEmail).filter(Boolean))].sort()

  return (
    <div className="mt-6 flex flex-col gap-2">
      <Panel
        tone="sky"
        icon={<Eye size={15} />}
        title="View as player"
        subtitle={email ? `Preview of ${email}'s screen. Spending is off here, but you can make their draft picks.` : 'Pick a player to see their screen.'}
        actions={
          <select value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Player to preview" className={FIELD}>
            <option value="">Pick a player…</option>
            {emails.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        }
      >
        {emails.length === 0 && <p className="m-0 text-xs text-stone-400">Set a player email on a character to preview what that player sees.</p>}
      </Panel>
      {email && <PlayerHome email={email} readOnly />}
    </div>
  )
}
