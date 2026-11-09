// DM tool: see the app exactly as one of your players does, read-only.
import { useState } from 'react'
import { useCharacters } from '../useCharacters'
import { PlayerHome } from './PlayerHome'

export function PlayerPreview() {
  const { characters } = useCharacters()
  const [email, setEmail] = useState('')
  const emails = [...new Set((characters ?? []).map((c) => c.playerEmail).filter(Boolean))].sort()

  return (
    <section className="panel preview">
      <div className="panel-header">
        <h2>View as player</h2>
        <select value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Player to preview">
          <option value="">Pick a player…</option>
          {emails.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>
      {emails.length === 0 && (
        <p className="hint">Set a player email on a character to preview what that player sees.</p>
      )}
      {email && (
        <>
          <p className="hint">Read-only preview of {email}'s screen. Spend buttons are disabled here.</p>
          <div className="preview-frame">
            <PlayerHome email={email} readOnly />
          </div>
        </>
      )}
    </section>
  )
}
