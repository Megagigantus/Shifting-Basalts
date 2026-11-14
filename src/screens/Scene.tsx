// Scene art for the rooms that aren't fights: the post-boss room (Forge,
// Healing Font, descend or extract), the Reprieve (Rest or Reflect) and
// Thils's Vault. Pictures come from src/art/rooms; anything missing just
// shows its text. Shared by the DM and player screens. These are pictures
// and explanations only; the choices themselves happen where they did before.
import type { RunState } from '../model/run'
import { artUrl } from '../art'
import { LAST_FLOOR } from '../rules/run'
import { healingFont } from '../rules/upgrades'
import { lootKeptIfExtracting } from '../rules/runFlow'

/** A wide scene picture with a title over it. */
export function SceneBanner({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  const url = artUrl('rooms', id)
  return (
    <figure className={`scene-banner${url ? '' : ' no-art'}`}>
      {url && <img src={url} alt="" />}
      <figcaption>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </figcaption>
    </figure>
  )
}

export interface Card {
  /** Picture in src/art/rooms. */
  id: string
  title: string
  text: string
  /** Shown faded (e.g. a cooled Forge). */
  faded?: boolean
}

/** A row of picture cards with captions. */
export function SceneCards({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null
  return (
    <ul className="scene-cards">
      {cards.map((c) => {
        const url = artUrl('rooms', c.id)
        return (
          <li key={c.id} className={c.faded ? 'is-faded' : undefined}>
            {url && <img src={url} alt="" />}
            <strong>{c.title}</strong>
            <span>{c.text}</span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The post-boss room: what's here (the party's Forge and Healing Font, when
 * someone owns them) and the choice ahead. `forDm` changes only the hint.
 */
export function PostBossScene({ state, forDm = false }: { state: RunState; forDm?: boolean }) {
  const { run } = state
  if (!run.awaitingChoice) return null
  const last = run.floor >= LAST_FLOOR
  const forgeHere = state.players.some((p) => p.alive && p.forgeOwner)
  const uses = run.forgeUsesLeft ?? 0
  const font = last ? null : healingFont(state.players)
  const cards: Card[] = []
  if (forgeHere) {
    cards.push({
      id: 'forge',
      title: 'The Forge',
      text: uses > 0 ? `${uses} use${uses === 1 ? '' : 's'} left: level up a boon, or evolve or combine Level 3 boons.` : 'Cooled for this floor.',
      faded: uses === 0,
    })
  }
  if (font) {
    cards.push({
      id: 'healing-font',
      title: 'The Healing Font',
      text:
        font.tempHp > 0
          ? `Restores the party. With ${font.owners} owners, everyone also gains ${font.tempHp} temp HP.`
          : 'Restores the party between floors.',
    })
  }
  if (!last) cards.push({ id: 'descend', title: 'Descend', text: `Go down to floor ${run.floor + 1}.` })
  cards.push({
    id: 'extract',
    title: last ? 'Finish the full clear' : 'Extract',
    text: last ? 'Take everything home.' : `Leave the Basalts with ${lootKeptIfExtracting(state)}% of the loot.`,
  })
  return (
    <div className="scene">
      <SceneBanner id="post-boss" title={last ? 'The legendary boss is defeated' : `Floor ${run.floor} boss defeated`} subtitle="The post-boss room" />
      <SceneCards cards={cards} />
      <p className="hint">
        {forDm
          ? 'Descend or extract with the run tracker buttons once the party decides.'
          : 'Decide together whether to go deeper or leave; the DM makes it happen.'}
      </p>
    </div>
  )
}

/** The Reprieve: a safe room where each player chooses Rest or Reflect (bible: Room types). */
export function ReprieveScene() {
  return (
    <div className="scene">
      <SceneBanner id="reprieve" title="A Reprieve" subtitle="A safe room: no fight here." />
      <SceneCards
        cards={[
          {
            id: 'rest',
            title: 'Rest',
            text: "A Short Rest's benefits, including Hit Point Dice and short-rest features, without the hour.",
          },
          { id: 'reflect', title: 'Reflect', text: 'Level up one boon.' },
        ]}
      />
      <p className="hint">Each player chooses one.</p>
    </div>
  )
}
