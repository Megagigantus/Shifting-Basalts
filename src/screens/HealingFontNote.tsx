// The Healing Font in a post-boss room, for the DM and players alike.
import type { RunState } from '../model/run'
import { LAST_FLOOR } from '../rules/run'
import { healingFont } from '../rules/upgrades'

export function HealingFontNote({ state }: { state: RunState }) {
  const font = healingFont(state.players)
  if (!font || !state.run.awaitingChoice || state.run.floor >= LAST_FLOOR) return null
  return (
    <p className="notice">
      Healing Font: it restores the party between floors.
      {font.tempHp > 0 &&
        ` With ${font.owners} owners, everyone also gains ${font.tempHp} temp HP (+5 per owner beyond the first).`}
    </p>
  )
}
