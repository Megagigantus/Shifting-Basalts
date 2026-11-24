// Basalt Echoes: every boon, Evolution, Fusion and hidden boon this player has held, across all their characters.
import { useState } from 'react'
import { Lock } from 'lucide-react'
import { setEchoSeen } from '../characterStore'
import type { Character } from '../model/character'
import { boon, combination, evolution, hiddenBoon } from '../rules/boons'
import { collectionOf, echoCounts, echoPool, visibleEchoCounts, type EchoGroup } from '../rules/echoes'
import { useCharacters } from '../useCharacters'
import { Pill } from '../ui/Pill'
import { tagInfo } from '../tagInfo'
import { StatStrip } from '../ui/StatStrip'
import { SMALL_BUTTON } from '../ui/styles'
import { cx } from '../ui/tone'

const GROUPS: { id: EchoGroup; label: string }[] = [
  { id: 'boons', label: 'Boons' },
  { id: 'evolutions', label: 'Evolutions' },
  { id: 'combinations', label: 'Fusions' },
  { id: 'hidden', label: 'Hidden' },
]

const SEEN_CARD = 'flex flex-col gap-2 rounded-lg border border-emerald-500/35 bg-stone-950/70 p-3'
const UNSEEN_CARD = 'flex min-h-24 flex-col gap-2 rounded-lg border border-stone-800 bg-stone-950/50 p-3 opacity-60'

/** Collection of every echo the character's player has held across runs and characters, with locked placeholders for the rest. */
export function BasaltEchoes({ character, canMark = false }: { character: Character; canMark?: boolean }) {
  const [group, setGroup] = useState<EchoGroup>('boons')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const counts = canMark ? echoCounts(character) : visibleEchoCounts(character)
  const showHidden = canMark || counts.hidden.seen > 0
  const activeGroup: EchoGroup = group === 'hidden' && !showHidden ? 'boons' : group
  const pool = echoPool(character)
  // Echoes are per player: seen entries come from the player's whole collection.
  const seenIds = new Set(collectionOf(character).echoes[activeGroup])
  const { characters } = useCharacters()
  const playerCharacterIds = character.playerEmail
    ? (characters ?? []).filter((c) => c.playerEmail === character.playerEmail).map((c) => c.id)
    : []
  const ids = pool[activeGroup]
  const orderedIds =
    !canMark && activeGroup === 'hidden'
      ? ids.filter((id) => seenIds.has(id))
      : [...ids.filter((id) => seenIds.has(id)), ...ids.filter((id) => !seenIds.has(id))]

  async function toggleSeen(id: string, seen: boolean) {
    setError(null)
    setBusy(true)
    try {
      await setEchoSeen(character.id, playerCharacterIds, activeGroup, id, seen)
    } catch {
      setError('Could not save. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <StatStrip
        stats={[
          { label: 'Overall', value: `${counts.overall.seen} of ${counts.overall.total}`, tone: 'emerald' },
          { label: 'Boons', value: `${counts.boons.seen} of ${counts.boons.total}` },
          { label: 'Evolutions', value: `${counts.evolutions.seen} of ${counts.evolutions.total}` },
          { label: 'Fusions', value: `${counts.combinations.seen} of ${counts.combinations.total}` },
          ...(showHidden ? [{ label: 'Hidden', value: `${counts.hidden.seen} of ${counts.hidden.total}` }] : []),
        ]}
      />

      <div className="flex flex-wrap gap-1.5">
        {GROUPS.filter((g) => showHidden || g.id !== 'hidden').map((g) => {
          const active = activeGroup === g.id
          const { seen, total } = counts[g.id]
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={active}
              onClick={() => setGroup(g.id)}
              className={cx(
                SMALL_BUTTON,
                active && 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/25',
              )}
            >
              <span>{g.label}</span>
              <span className={cx('font-mono text-[0.625rem]', active ? 'text-emerald-300' : 'text-stone-400')}>
                {seen} of {total}
              </span>
            </button>
          )
        })}
      </div>

      {counts.overall.seen === 0 && (
        <p className="m-0 text-xs text-stone-400">
          {canMark
            ? 'No echoes yet. Every boon, Evolution, Fusion and hidden boon you hold in a run is recorded here.'
            : 'No echoes yet. Every boon, Evolution and Fusion you hold in a run is recorded here.'}
        </p>
      )}

      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {orderedIds.map((id) =>
          seenIds.has(id) ? (
            <SeenCard key={id} group={activeGroup} id={id} canMark={canMark} busy={busy} onUnmark={() => toggleSeen(id, false)} />
          ) : (
            <UnseenCard key={id} group={activeGroup} id={id} canMark={canMark} busy={busy} onMark={() => toggleSeen(id, true)} />
          ),
        )}
      </div>
    </div>
  )
}

function echoName(group: EchoGroup, id: string): string {
  if (group === 'boons') return boon(id).name
  if (group === 'evolutions') return evolution(id).name
  if (group === 'combinations') return combination(id).name
  return hiddenBoon(id).name
}

function SeenCard({
  group,
  id,
  canMark,
  busy,
  onUnmark,
}: {
  group: EchoGroup
  id: string
  canMark: boolean
  busy: boolean
  onUnmark: () => void
}) {
  return (
    <div className={SEEN_CARD}>
      {group === 'boons' && <BoonDetails id={id} />}
      {group === 'evolutions' && <EvolutionDetails id={id} />}
      {group === 'combinations' && <CombinationDetails id={id} />}
      {group === 'hidden' && <HiddenDetails id={id} />}
      {canMark && (
        <div className="mt-auto pt-1">
          <button type="button" className={cx(SMALL_BUTTON, 'text-stone-400')} disabled={busy} onClick={onUnmark}>
            Unmark
          </button>
        </div>
      )}
    </div>
  )
}

function UnseenCard({
  group,
  id,
  canMark,
  busy,
  onMark,
}: {
  group: EchoGroup
  id: string
  canMark: boolean
  busy: boolean
  onMark: () => void
}) {
  return (
    <div className={UNSEEN_CARD}>
      <div className="flex items-center gap-1.5 text-stone-400">
        <Lock size={14} aria-hidden="true" />
        <strong className="text-sm font-bold text-stone-400">{canMark ? echoName(group, id) : '???'}</strong>
      </div>
      <p className="m-0 text-[0.6875rem] text-stone-500">An echo not yet heard.</p>
      {canMark && (
        <div className="mt-auto pt-1">
          <button type="button" className={SMALL_BUTTON} disabled={busy} onClick={onMark}>
            Mark as seen
          </button>
        </div>
      )}
    </div>
  )
}

function BoonDetails({ id }: { id: string }) {
  const b = boon(id)
  const kindLabel = b.kind === 'core' ? 'Core' : b.kind === 'payoff' ? 'Payoff' : null
  const tags = kindLabel ? b.tags.filter((t) => t !== kindLabel) : b.tags
  return (
    <>
      <strong className="text-sm font-bold text-stone-100">{b.name}</strong>
      {(tags.length > 0 || kindLabel) && (
        <div className="flex flex-wrap gap-1.5">
          {kindLabel && (
            <Pill tone="emerald" title={tagInfo(kindLabel)} className="cursor-help">
              {kindLabel}
            </Pill>
          )}
          {tags.map((tag) => (
            <Pill key={tag} title={tagInfo(tag)} className="cursor-help">
              {tag}
            </Pill>
          ))}
        </div>
      )}
      <dl className="m-0 flex flex-col gap-1.5 text-[0.6875rem]">
        {b.levels.map((text, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <dt className="font-semibold text-emerald-300/90">Level {i + 1}</dt>
            <dd className="m-0 text-stone-300">{text}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

function EvolutionDetails({ id }: { id: string }) {
  const e = evolution(id)
  return (
    <>
      <strong className="text-sm font-bold text-stone-100">{e.name}</strong>
      <p className="m-0 text-xs text-emerald-300/90">Evolves from {boon(e.from).name}</p>
      <p className="m-0 text-[0.6875rem] text-stone-300">{e.effect}</p>
    </>
  )
}

function CombinationDetails({ id }: { id: string }) {
  const c = combination(id)
  return (
    <>
      <strong className="text-sm font-bold text-stone-100">{c.name}</strong>
      <p className="m-0 text-xs text-emerald-300/90">
        Fuses {boon(c.boons[0]).name} + {boon(c.boons[1]).name}
      </p>
      <p className="m-0 text-[0.6875rem] text-stone-300">{c.effect}</p>
    </>
  )
}

function HiddenDetails({ id }: { id: string }) {
  const h = hiddenBoon(id)
  const kindLabel = h.kind === 'class' ? 'Class hidden boon' : "Thils's gift"
  return (
    <>
      <strong className="text-sm font-bold text-stone-100">{h.name}</strong>
      <div className="flex flex-wrap gap-1.5">
        <Pill tone="emerald">{kindLabel}</Pill>
      </div>
      <p className="m-0 text-[0.6875rem] text-stone-300">{h.effect}</p>
      {h.kind === 'class' && h.condition && (
        <p className="m-0 text-[0.6875rem] text-stone-400">
          <span className="font-semibold text-stone-300">Earned by:</span> {h.condition}
        </p>
      )}
    </>
  )
}
