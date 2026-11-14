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
import { useLightbox } from '../ui/lightboxContext'
import { cx, toneClasses, type Tone } from '../ui/tone'

/** A wide scene picture with a title over it. Click to enlarge. */
export function SceneBanner({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  const url = artUrl('rooms', id)
  const showArt = useLightbox()
  const caption = (
    <figcaption className="absolute inset-x-0 bottom-0 p-4 text-left">
      <strong className="block text-lg font-bold text-stone-50 drop-shadow">{title}</strong>
      {subtitle && <span className="block text-xs text-stone-300">{subtitle}</span>}
    </figcaption>
  )
  if (!url) {
    return (
      <figure className="relative m-0 h-28 overflow-hidden rounded-2xl border border-stone-800 bg-gradient-to-br from-stone-800 via-stone-900 to-stone-950">
        {caption}
      </figure>
    )
  }
  return (
    <figure className="m-0">
      <button
        type="button"
        onClick={() => showArt({ src: url, title, subtitle })}
        aria-label={`Enlarge ${title}`}
        className="group relative box-border block aspect-[16/6] max-h-72 w-full cursor-pointer overflow-hidden rounded-2xl border border-amber-500/30 bg-stone-950 p-0"
      >
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent" />
        {caption}
      </button>
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

/** Each station's accent color. */
const STATION_TONES: Record<string, Tone> = {
  forge: 'amber',
  'healing-font': 'emerald',
  descend: 'indigo',
  extract: 'sky',
  rest: 'emerald',
  reflect: 'violet',
}

/** A grid of station cards: picture, title and what it does. */
export function SceneCards({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2">
      {cards.map((c) => {
        const url = artUrl('rooms', c.id)
        const tone = STATION_TONES[c.id] ?? 'stone'
        return (
          <li
            key={c.id}
            className={cx('overflow-hidden rounded-xl border bg-stone-950/70', toneClasses[tone].border, c.faded && 'opacity-50 grayscale')}
          >
            {url && (
              <div className="relative aspect-[16/7] overflow-hidden">
                <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent" />
              </div>
            )}
            <div className="flex flex-col gap-1 p-3">
              <strong className={cx('text-sm', toneClasses[tone].text)}>{c.title}</strong>
              <span className="text-xs text-stone-300">{c.text}</span>
            </div>
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
    <div className="flex flex-col gap-3">
      <SceneBanner id="post-boss" title={last ? 'The legendary boss is defeated' : `Floor ${run.floor} boss defeated`} subtitle="The post-boss room" />
      <SceneCards cards={cards} />
      <p className="m-0 text-[0.6875rem] text-stone-400">
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
    <div className="flex flex-col gap-3">
      <SceneBanner id="reprieve" title="A Reprieve" subtitle="A safe room: no fight here." />
      <SceneCards
        cards={[
          {
            id: 'rest',
            title: 'Rest',
            text: "A Short Rest's benefits, including Hit Point Dice and short-rest features, without the hour.",
          },
          { id: 'reflect', title: 'Reflect', text: 'Level up one boon. With no boon left to level, take catch-up Quantum Basalts instead.' },
        ]}
      />
      <p className="m-0 text-[0.6875rem] text-stone-400">Each player chooses one. The party moves on once everyone has chosen.</p>
    </div>
  )
}
