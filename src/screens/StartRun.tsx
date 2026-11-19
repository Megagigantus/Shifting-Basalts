// DM screen: pick who's entering and which Pressures, then start a run.
import { portraitHonors } from '../rules/portraitHonors'
import { Portrait } from '../ui/Portrait'
import { useState } from 'react'
import { DoorOpen, Lock, Swords } from 'lucide-react'
import { Panel, SectionLabel } from '../ui/Panel'
import { StatStrip } from '../ui/StatStrip'
import { PRIMARY_BUTTON, WELL } from '../ui/styles'
import { cx } from '../ui/tone'
import { buildOf, type Character } from '../model/character'
import { buildSummary } from '../rules/build'
import { BuildSummary } from './BuildPanel'
import {
  availablePressures,
  entryMultiplier,
  partyLevel,
  pressureBonusPercent,
  PRESSURES,
  sharedPlayers,
  toggleEntrant,
  togglePressure,
} from '../rules/run'
import { makeJoinCode, newRunState } from '../rules/runFlow'
import { openStartingBoons } from '../rules/draftFlow'
import { startFloor } from '../rules/roomFlow'
import { deepPocketsPercent, extraPressuresBonusPercent } from '../rules/upgrades'
import { newRunId, saveRunState } from '../runStore'
import { usePressureWishes, wishTally } from '../pressureWishes'

const EXTRA_PRESSURES = 'extra-pressures'


interface Props {
  characters: Character[]
}

export function StartRun({ characters }: Props) {
  const [picked, setPicked] = useState<string[]>([])
  const [pressures, setPressures] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  const party = characters.filter((c) => picked.includes(c.id))
  const level = partyLevel(party.map((c) => c.level))
  // Extra Pressures is party-wide: the highest rank anyone in the party owns applies.
  const extraRank = Math.max(0, ...party.map((c) => c.upgrades[EXTRA_PRESSURES] ?? 0))
  const unlocked = new Set(availablePressures(extraRank).map((p) => p.id))
  // Drop any picked Pressure that's no longer unlocked (e.g. its owner was unticked).
  const activePressures = pressures.filter((id) => unlocked.has(id))
  // Pressure votes from the entering characters' players.
  const wanted = wishTally(usePressureWishes(), party)

  function toggleCharacter(id: string) {
    setPicked((ids) => toggleEntrant(ids, id, characters))
  }

  async function start() {
    setError(null)
    if (party.length === 0) return setError('Pick at least one character.')
    if (sharedPlayers(party).length > 0) return setError('Each player can bring only one character.')
    setStarting(true)
    try {
      const owners = party.filter((c) => (c.upgrades['starting-boon'] ?? 0) > 0).map((c) => c.id)
      const state = startFloor(
        openStartingBoons(newRunState(newRunId(), makeJoinCode(), party, activePressures), owners, Math.random),
        Math.random,
      )
      await saveRunState(state, null, characters)
      // The live listener picks up the new run and replaces this screen with
      // the tracker, so the button stays on "Starting…" until then.
    } catch {
      setError('Could not start the run. Please try again.')
      setStarting(false)
    }
  }

  const extraBonus = extraPressuresBonusPercent(party)
  const pockets = deepPocketsPercent(party)

  return (
    <Panel
      hero
      tone="amber"
      icon={<DoorOpen size={16} />}
      title="Prepare next run"
      subtitle="Pick who's entering and which Pressures. Party level sets the entry tier, encounters and DCs."
      actions={
        <button
          type="button"
          onClick={start}
          disabled={starting || party.length === 0}
          className={PRIMARY_BUTTON}
        >
          <Swords size={15} />
          {starting ? 'Starting…' : party.length > 0 ? `Enter the Basalts (${party.length})` : 'Enter the Basalts'}
        </button>
      }
    >
      <SectionLabel>Who's entering?</SectionLabel>
      {characters.length === 0 && <p className="m-0 text-xs text-stone-400">Add characters on the Characters tab first.</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {characters.map((c) => {
          const locked = c.lockoutDays > 0
          const chosen = picked.includes(c.id)
          const swapsOut =
            !chosen && !locked && c.playerEmail
              ? party.find((p) => p.playerEmail === c.playerEmail)
              : undefined
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={chosen}
              disabled={locked}
              onClick={() => toggleCharacter(c.id)}
              className={cx(
                'flex items-center gap-3 rounded-xl border p-3 text-left cursor-pointer transition-colors disabled:cursor-not-allowed',
                chosen
                  ? 'border-amber-500/50 bg-amber-500/15'
                  : locked
                    ? 'border-rose-500/30 bg-stone-950/60 opacity-60'
                    : 'border-stone-800 bg-stone-950/60 opacity-70 hover:opacity-100',
              )}
            >
              <Portrait portrait={c.portrait} name={c.name} honors={portraitHonors(c)} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-stone-100">{c.name}</span>
                  <span className="shrink-0 font-mono text-[0.6875rem] font-bold text-amber-300">Lv {c.level}</span>
                </span>
                <span className="block truncate text-[0.6875rem] text-stone-400">
                  {buildSummary({ ...c, ...buildOf(c) })} · {c.bankedQuantumBasalts} QB
                </span>
                {locked && <span className="block text-[0.6875rem] font-semibold text-rose-300">Locked out {c.lockoutDays} days</span>}
                {swapsOut && <span className="block text-[0.6875rem] text-amber-300/80">Swaps out {swapsOut.name}</span>}
              </span>
            </button>
          )
        })}
      </div>

      {party.length > 0 && (
        <>
          <SectionLabel>Builds to review</SectionLabel>
          <p className="m-0 text-[0.6875rem] text-stone-500">Players set these on their own devices. Check them before entering; Edit on the Characters tab to correct one.</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {party.map((c) => (
              <div key={c.id} className={WELL}>
                <span className="text-xs font-bold text-amber-200">{c.name}</span>
                <BuildSummary character={c} />
              </div>
            ))}
          </div>
        </>
      )}

      <StatStrip
        stats={[
          { label: 'Party level', value: party.length ? `${level} (×${entryMultiplier(level)})` : '–', tone: 'amber', hint: 'Rewards multiplier' },
          { label: 'Players', value: party.length },
          { label: 'Pressure bonus', value: `+${pressureBonusPercent(activePressures)}%`, tone: 'emerald' },
          { label: 'Extra Pressures', value: `+${extraBonus}%`, tone: extraBonus > 0 ? 'emerald' : 'stone', hint: 'From upgrades' },
          { label: 'Deep Pockets', value: `+${pockets}%`, tone: pockets > 0 ? 'emerald' : 'stone', hint: 'Loot kept' },
        ]}
      />

      <SectionLabel>Pressures</SectionLabel>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {PRESSURES.map((p) => {
          const isUnlocked = unlocked.has(p.id)
          const active = activePressures.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              disabled={!isUnlocked}
              onClick={() => setPressures((ids) => togglePressure(ids, p.id))}
              className={cx(
                'rounded-xl border p-3 text-left cursor-pointer transition-colors disabled:cursor-not-allowed',
                active
                  ? 'border-rose-500/50 bg-rose-500/15'
                  : isUnlocked
                    ? 'border-stone-800 bg-stone-950/60 hover:border-stone-700'
                    : 'border-stone-800 bg-stone-950/40 opacity-50',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cx('text-sm font-bold', active ? 'text-rose-200' : 'text-stone-100')}>
                  {!isUnlocked && <Lock size={12} className="mr-1 inline" />}
                  {p.name}
                </span>
                <span className="font-mono text-xs font-bold text-emerald-300">+{p.bonusPercent}%</span>
              </span>
              <span className="mt-1 block text-[0.6875rem] text-stone-400">{p.effect}</span>
              {(wanted[p.id]?.length ?? 0) > 0 && (
                <span className="mt-1.5 inline-block rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[0.625rem] font-semibold text-sky-200">
                  Wanted by {wanted[p.id].length}: {wanted[p.id].join(', ')}
                </span>
              )}
              {!isUnlocked && <span className="mt-1 block text-[0.6875rem] text-stone-500">Needs Extra Pressures rank {p.unlockRank}</span>}
            </button>
          )
        })}
      </div>

      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </Panel>
  )
}
