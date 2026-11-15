// Player screen: the run their character is in, read-only. Shows where the
// party is and everyone's boons; never anything from the DM-only data.
// Wide screens: main column (draft, room, loot) plus a party sidebar. Phones:
// one column, with the party cards (yours first) right after the banner.
import { hasFullClear } from '../rules/upgrades'
import { useState } from 'react'
import { Skull } from 'lucide-react'
import type { RunPlayer, RunState } from '../model/run'
import { boonSummary } from '../rules/boons'
import { floorInfo, LAST_FLOOR, PRESSURES } from '../rules/run'
import { canExtract, isBossRoom, lootKeptIfExtracting } from '../rules/runFlow'
import { BoonList } from './BoonList'
import { PlayerDraft } from './PlayerDraft'
import { PlayerRoom } from './PlayerRoom'
import { submitChoice, useChoices, useExitVotes, useLootRequests, type ChoiceDoc } from '../runStore'
import { ExitVoteButtons, ExitVoteTally } from './ExitVote'
import { PlayerLoot } from './LootScreens'
import { RecoveryPanel } from './RecoveryPanel'
import { describeReprieve } from '../rules/reprieve'
import { CounterList } from './CountersPanel'
import { PostBossScene } from './Scene'
import { useLooks } from './mapPieces'
import { artUrl } from '../art'
import { Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { cx, initials } from '../ui/tone'

interface Props {
  state: RunState
  myCharacterIds: string[]
  /** The DM's read-only preview. */
  readOnly?: boolean
}

export function PlayerRun({ state, myCharacterIds, readOnly = false }: Props) {
  const { run, players } = state
  const choices = useChoices(run.id)
  const requests = useLootRequests(run.id)
  const votes = useExitVotes(run.id)
  const looks = useLooks()
  const [open, setOpen] = useState<string | null>(myCharacterIds[0] ?? null)
  const floor = floorInfo(run.floor)
  const bossRoom = isBossRoom(state)
  const mine = players.filter((p) => myCharacterIds.includes(p.characterId))
  // Your characters first, then the rest of the party.
  const party = [...mine, ...players.filter((p) => !myCharacterIds.includes(p.characterId))]

  const where = run.awaitingChoice
    ? `Floor ${run.floor} boss defeated: descend or extract?`
    : bossRoom
      ? run.floor === LAST_FLOOR
        ? 'Floor 5: the legendary boss'
        : `Floor ${run.floor}: boss room`
      : `Floor ${run.floor}: room ${run.room} of ${floor.rooms}`

  return (
    <div className="mt-6 flex flex-col gap-4">
      <Panel hero tone="amber">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone="amber">
            Floor {run.floor} of {LAST_FLOOR}
          </Pill>
          {bossRoom && !run.awaitingChoice && <Pill tone="rose">Boss</Pill>}
          <Pill>Hazard {floor.hazard}</Pill>
          {run.pressures.map((id) => (
            <Pill key={id} tone="rose">
              {PRESSURES.find((p) => p.id === id)?.name ?? id}
            </Pill>
          ))}
        </div>
        <h2 className="m-0 text-base font-bold text-stone-50">{where}</h2>
        <p className="m-0 text-[0.6875rem] text-stone-400">
          Party level {run.partyLevel} · rewards ×{run.entryMultiplier} · Loot kept if the party extracts now:{' '}
          <span className="font-semibold text-stone-200">
            {canExtract(state) ? `${lootKeptIfExtracting(state)}%` : 'opens after a boss'}
          </span>
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
          {mine.map((p) => (
            // In the DM's preview (readOnly), the DM can still pick boons for the player.
            <PlayerDraft key={p.characterId} state={state} player={p} sent={choices[p.characterId]} readOnly={readOnly} dmChoosing={readOnly} />
          ))}

          {run.awaitingChoice && (
            <Panel>
              <PostBossScene state={state} />
              <ExitVoteButtons state={state} mine={mine} votes={votes} readOnly={readOnly} />
              <ExitVoteTally state={state} votes={votes} />
            </Panel>
          )}

          <PlayerRoom
            key={`${run.floor}-${run.room}`}
            state={state}
            me={mine[0] ?? null}
            myCharacterIds={myCharacterIds}
            readOnly={readOnly}
          />

          <PlayerLoot state={state} myCharacterIds={myCharacterIds} requests={requests} readOnly={readOnly} />
        </div>

        {/* On phones this comes right after the banner, so your own card is near the top. */}
        <aside className="order-first flex min-w-0 flex-col gap-3 lg:order-none lg:col-span-4" aria-label="Party">
          {party.map((p) => (
            <PartyCard
              key={p.characterId}
              player={p}
              portrait={looks[p.characterId]?.portrait}
              glow={hasFullClear(looks[p.characterId] ?? {})}
              isMine={myCharacterIds.includes(p.characterId)}
              open={open === p.characterId}
              onToggle={() => setOpen(open === p.characterId ? null : p.characterId)}
              sent={choices[p.characterId]}
              readOnly={readOnly}
              onSpend={(choice) => submitChoice(run.id, p.characterId, choice, null)}
            />
          ))}
        </aside>
      </div>
    </div>
  )
}

interface CardProps {
  player: RunPlayer
  portrait: string | undefined
  /** Survived a full clear: a golden glow around the portrait. */
  glow: boolean
  isMine: boolean
  open: boolean
  onToggle: () => void
  sent: ChoiceDoc | undefined
  readOnly: boolean
  onSpend: Parameters<typeof RecoveryPanel>[0]['onSpend']
}

/** One party member: rewards so far, boons (tap to open), counters, and your own slot recovery. */
function PartyCard({ player: p, portrait, glow, isMine, open, onToggle, sent, readOnly, onSpend }: CardProps) {
  const url = portrait ? artUrl('portraits', portrait) : null
  const summary = boonSummary(p.slots, p.hiddenBoonId)
  return (
    <section
      className={cx(
        'flex flex-col gap-2.5 rounded-xl border bg-stone-900/90 p-3.5 text-stone-100',
        !p.alive ? 'border-rose-500/30 opacity-75' : isMine ? 'border-sky-500/40' : 'border-stone-800',
      )}
    >
      <header className="flex items-center gap-3">
        {url ? (
          <img src={url} alt="" className={cx('h-11 w-11 shrink-0 rounded-full border border-stone-700 object-cover', glow && 'full-clear-glow')} />
        ) : (
          <span className={cx(glow && 'full-clear-glow', 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-700 bg-stone-800 font-mono text-xs font-bold text-stone-400')}>
            {initials(p.name)}
          </span>
        )}
        <h3 className="m-0 min-w-0 flex-1 truncate text-sm font-bold">{p.name}</h3>
        {isMine && <Pill tone="sky">You</Pill>}
        {!p.alive && (
          <Pill tone="rose" icon={<Skull size={11} />}>
            Fallen
          </Pill>
        )}
      </header>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="purple" mono title="Boss Quantum Basalts, before bonuses. Lost on death.">
          {p.alive ? `Run QB ${p.quantumBasaltsEarned}` : `Run QB ${p.quantumBasaltsEarned} (forfeit)`}
        </Pill>
        <Pill tone="emerald" mono title="Quantum Basalts from passing. Kept even on death.">
          Safe QB {p.quantumBasaltsPassed}
        </Pill>
        <Pill tone="indigo" mono title="Devotions earned this run">
          {p.devotions} Devotions
        </Pill>
      </div>
      {summary && !open && <p className="m-0 text-[0.6875rem] text-stone-300">{summary}</p>}
      <CounterList player={p} />
      {(p.reprieves?.length ?? 0) > 0 && (
        <p className="m-0 text-[0.6875rem] text-emerald-200/80">
          {p.reprieves!.map((r) => `Floor ${r.floor} Reprieve: ${describeReprieve(r)}`).join(' · ')}
        </p>
      )}
      {isMine && <RecoveryPanel player={p} busy={readOnly || Boolean(sent && !sent.error)} onSpend={onSpend} />}
      {!p.alive && (
        <p className="m-0 text-[0.6875rem] text-rose-300">
          Fell on floor {p.diedOnFloor} · locked out {p.lockoutDays} days
        </p>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cx(
          'cursor-pointer self-start rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
          open ? 'border-amber-500/40 bg-amber-500/20 text-amber-200' : 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800',
        )}
      >
        {open ? 'Hide boons' : 'Boons'}
      </button>
      {open && <BoonList player={p} />}
    </section>
  )
}
