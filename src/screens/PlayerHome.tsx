// What an invited player sees: the run their character is in (if any), then
// their own characters' hubs (profile, Basalt Shrine, Basalt Markets) and
// their past runs. The DM can also open this read-only via "Player view".
import { useState } from 'react'
import { useActiveRun } from '../runStore'
import { useCharacters } from '../useCharacters'
import { PlayerRun } from './PlayerRun'
import { CharacterHub } from './CharacterHub'
import { Roster } from './Roster'
import { RunHistory } from './RunHistory'
import { Panel } from '../ui/Panel'

interface Props {
  email: string
  /** True for the DM's preview: everything shows, nothing can be spent. */
  readOnly?: boolean
}

export function PlayerHome({ email, readOnly = false }: Props) {
  const { characters, error } = useCharacters()
  const { state } = useActiveRun()
  const [selected, setSelected] = useState<string | null>(null)

  const mine = (characters ?? []).filter((c) => c.playerEmail === email.toLowerCase())
  const myIds = mine.map((c) => c.id)
  const myRun = state && state.run.characterIds.some((id) => myIds.includes(id)) ? state : null
  const current = mine.find((c) => c.id === selected) ?? mine[0] ?? null

  return (
    <>
      {myRun && <PlayerRun state={myRun} myCharacterIds={myIds} readOnly={readOnly} />}

      <div className="mt-6 flex flex-col gap-4">
        {characters === null && !error && <p className="m-0 text-sm text-stone-400">Loading…</p>}
        {error && <p className="m-0 text-sm text-rose-300">{error}</p>}
        {characters && mine.length === 0 && (
          <Panel title="No character yet">
            <p className="m-0 text-xs text-stone-300">
              Your DM hasn't assigned you a character yet. They set the player email on your character to {email.toLowerCase()}.
            </p>
          </Panel>
        )}
        {!myRun && mine.length > 0 && <p className="m-0 text-xs text-stone-400">You're not in a run right now.</p>}

        {current && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {mine.length > 1 && (
              <div className="lg:col-span-3">
                <Roster characters={mine} selectedId={current.id} onSelect={setSelected} title="Your characters" />
              </div>
            )}
            <div className={mine.length > 1 ? 'min-w-0 lg:col-span-9' : 'min-w-0 lg:col-span-12'}>
              <CharacterHub key={current.id} character={current} mode={readOnly ? 'preview' : 'player'} />
            </div>
          </div>
        )}
      </div>

      {mine.length > 0 && <RunHistory characterIds={myIds} title="Your past runs" />}
    </>
  )
}
