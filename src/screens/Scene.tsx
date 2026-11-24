// Scene art for the rooms that aren't fights: the post-boss room (Forge,
// Healing Font, descend or extract), the Reprieve (Rest or Reflect) and
// Thils's Vault. Pictures come from src/art/rooms; anything missing just
// shows its text. Shared by the DM and player screens. In the post-boss room,
// the Forge and Healing Font cards flip open (and the Forge is used on its
// card), and players can vote on the Descend and Extract cards.
import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { RotateCw } from 'lucide-react'
import type { RunState } from '../model/run'
import { artUrl } from '../art'
import { LAST_FLOOR } from '../rules/run'
import { healingFont } from '../rules/upgrades'
import { lootKeptIfExtracting } from '../rules/runFlow'
import { reclaimable, shrineCost, shrineHere } from '../rules/shrine'
import { votingOpen, type ExitVote } from '../rules/votes'
import { useLightbox } from '../ui/lightboxContext'
import { Pill } from '../ui/Pill'
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
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  back?: ReactNode
  backTitle?: string
}

/** Each station's accent color. */
const STATION_TONES: Record<string, Tone> = {
  forge: 'amber',
  'healing-font': 'emerald',
  shrine: 'amber',
  descend: 'indigo',
  extract: 'sky',
  rest: 'emerald',
  reflect: 'violet',
}

/** Highlight classes for a selected interactive card in its tone. */
const SELECTED_RING: Record<Tone, string> = {
  amber: 'border-amber-400 ring-2 ring-amber-400/60',
  emerald: 'border-emerald-400 ring-2 ring-emerald-400/60',
  rose: 'border-rose-400 ring-2 ring-rose-400/60',
  sky: 'border-sky-400 ring-2 ring-sky-400/60',
  indigo: 'border-indigo-400 ring-2 ring-indigo-400/60',
  violet: 'border-violet-400 ring-2 ring-violet-400/60',
  purple: 'border-purple-400 ring-2 ring-purple-400/60',
  teal: 'border-teal-400 ring-2 ring-teal-400/60',
  fuchsia: 'border-fuchsia-400 ring-2 ring-fuchsia-400/60',
  stone: 'border-stone-400 ring-2 ring-stone-400/60',
}

function FlipCard({ card: c, url, tone }: { card: Card; url: string | null; tone: Tone }) {
  const [flipped, setFlipped] = useState(false)
  const toggle = () => setFlipped((f) => !f)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={flipped ? `Show front of ${c.title}` : `Open ${c.title}`}
      onClick={toggle}
      onKeyDown={onKeyDown}
      className={cx(
        'group relic-flip flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-stone-950/70 text-left',
        toneClasses[tone].border,
        c.faded && 'opacity-50 grayscale',
        flipped && 'is-flipped',
      )}
    >
      <div className="relic-flip-inner">
        <div className="relic-flip-face relic-flip-front flex flex-col" aria-hidden={flipped || undefined} inert={flipped}>
          {url && (
            <div className="relative aspect-[16/7] w-full overflow-hidden">
              <img
                src={url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent" />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1 p-3">
            <strong className={cx('text-sm', toneClasses[tone].text)}>{c.title}</strong>
            <span className="text-xs text-stone-300">{c.text}</span>
            <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[0.6875rem] text-stone-500">
              <RotateCw size={11} /> Tap to open
            </span>
          </div>
        </div>
        <div className="relic-flip-face relic-flip-back flex flex-col gap-2 p-3" aria-hidden={!flipped || undefined} inert={!flipped}>
          <strong className={cx('text-sm', toneClasses[tone].text)}>{c.backTitle ?? c.title}</strong>
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="flex flex-col gap-2 text-xs text-stone-200"
          >
            {c.back}
          </div>
          <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[0.6875rem] text-stone-500">
            <RotateCw size={11} /> Tap to flip back
          </span>
        </div>
      </div>
    </div>
  )
}

/** A grid of station cards: picture, title and what it does. */
export function SceneCards({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2">
      {cards.map((c) => {
        const url = artUrl('rooms', c.id)
        const tone = STATION_TONES[c.id] ?? 'stone'
        if (c.back) {
          return (
            <li key={c.id} className="flex">
              <FlipCard card={c} url={url} tone={tone} />
            </li>
          )
        }
        const content = (
          <>
            {url && (
              <div className="relative aspect-[16/7] w-full overflow-hidden">
                <img
                  src={url}
                  alt=""
                  className={cx(
                    'absolute inset-0 h-full w-full object-cover',
                    c.onClick && !c.disabled && 'transition-transform duration-300 group-hover:scale-[1.02]',
                  )}
                />
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-stone-950 to-transparent" />
              </div>
            )}
            <div className="flex w-full flex-col gap-1 p-3">
              {c.selected ? (
                <div className="flex items-center justify-between gap-2">
                  <strong className={cx('text-sm', toneClasses[tone].text)}>{c.title}</strong>
                  <Pill tone={tone}>Your vote</Pill>
                </div>
              ) : (
                <strong className={cx('text-sm', toneClasses[tone].text)}>{c.title}</strong>
              )}
              <span className="text-xs text-stone-300">{c.text}</span>
            </div>
          </>
        )
        if (!c.onClick) {
          return (
            <li
              key={c.id}
              className={cx('overflow-hidden rounded-xl border bg-stone-950/70', toneClasses[tone].border, c.faded && 'opacity-50 grayscale')}
            >
              {content}
            </li>
          )
        }
        return (
          <li key={c.id} className="flex">
            <button
              type="button"
              aria-pressed={Boolean(c.selected)}
              disabled={c.disabled}
              onClick={c.onClick}
              className={cx(
                'group box-border flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-stone-950/70 p-0 text-left transition-colors disabled:cursor-default disabled:opacity-60',
                !c.disabled && 'hover:bg-stone-900/90',
                c.selected ? SELECTED_RING[tone] : toneClasses[tone].border,
                c.faded && 'opacity-50 grayscale',
              )}
            >
              {content}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The post-boss room: what's here (the party's Forge and Healing Font, when
 * someone owns them) and the choice ahead. `forDm` changes only the hint;
 * `vote` lets players cast their Descend/Extract vote directly on the cards.
 */
export function PostBossScene({
  state,
  forDm = false,
  vote,
  forgeBack,
}: {
  state: RunState
  forDm?: boolean
  vote?: { current: ExitVote | null; onVote: (v: ExitVote) => void; disabled: boolean }
  forgeBack?: ReactNode
}) {
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
      text: uses > 0 ? `${uses} use${uses === 1 ? '' : 's'} left: level up a boon, or evolve or fuse Level 3 boons.` : 'Cooled for this floor.',
      faded: uses === 0,
      back: uses > 0 ? forgeBack : undefined,
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
      back: (
        <>
          <p className="m-0 font-semibold text-emerald-200">Heal to full Hit Points.</p>
          {font.tempHp > 0 && (
            <p className="m-0 text-emerald-200">
              Then everyone gains {font.tempHp} temp HP ({font.owners} owners).
            </p>
          )}
          <p className="m-0 text-stone-300">Every living player heals.</p>
        </>
      ),
    })
  }
  if (shrineHere(state)) {
    const lost = reclaimable(state).length
    cards.push({
      id: 'shrine',
      title: 'The Reclamation Shrine',
      text: lost
        ? `Bring back ${lost === 1 ? 'the ally' : `any of the ${lost} allies`} lost on this floor for ${shrineCost(state)} Basalts each.`
        : 'Nobody to reclaim on this floor.',
      faded: lost === 0,
    })
  }
  const canVote = !forDm && Boolean(vote) && votingOpen(state)
  const voteProps = (id: ExitVote): Pick<Card, 'onClick' | 'selected' | 'disabled'> =>
    vote && canVote ? { onClick: () => vote.onVote(id), selected: vote.current === id, disabled: vote.disabled } : {}
  if (!last) cards.push({ id: 'descend', title: 'Descend', text: `Go down to floor ${run.floor + 1}.`, ...voteProps('descend') })
  cards.push({
    id: 'extract',
    title: last ? 'Finish the full clear' : 'Extract',
    text: last ? 'Take everything home.' : `Leave the Basalts with ${lootKeptIfExtracting(state)}% of the loot.`,
    ...voteProps('extract'),
  })
  return (
    <div className="flex flex-col gap-3">
      <SceneBanner id="post-boss" title={last ? 'The legendary boss is defeated' : `Floor ${run.floor} boss defeated`} subtitle="The post-boss room" />
      <SceneCards cards={cards} />
      <p className="m-0 text-[0.6875rem] text-stone-400">
        {forDm
          ? 'Descend or extract with the run tracker buttons once the party decides.'
          : canVote
            ? 'Tap Descend or Extract to vote; the DM makes the final call.'
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
