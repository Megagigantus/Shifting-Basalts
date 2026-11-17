// One character's hub, shared by the DM's Characters tab and the player's
// home: profile, what the dungeon adds to their sheet, draft preferences,
// loot, and the Basalt Shrine (stat tracks), Basalt Markets (upgrades) and
// Basalt Echoes (collection) as art banners that open when visited.
import { useState, type ReactNode } from 'react'
import { Landmark, Library, LogOut, Minus, Plus, Store } from 'lucide-react'
import { changeFullClears } from '../characterStore'
import { buildOf, CASTER_TYPES, type Character } from '../model/character'
import { buildSummary } from '../rules/build'
import { echoCounts, visibleEchoCounts } from '../rules/echoes'
import { proficiencyBonus } from '../rules/proficiency'
import { effectAtRank, rankProgress, STAT_TRACKS } from '../rules/statTracks'
import { hasFullClear, UPGRADES } from '../rules/upgrades'
import { artUrl } from '../art'
import { BasaltEchoes } from './BasaltEchoes'
import { BuildPanel } from './BuildPanel'
import { DraftPreferences } from './DraftPreferences'
import { LookPicker } from './LookPicker'
import { Portrait } from '../ui/Portrait'
import { portraitHonors } from '../rules/portraitHonors'
import { CharacterLoot } from './LootScreens'
import { StatTracks } from './StatTracks'
import { UpgradeShop } from './UpgradeShop'
import { Panel, SectionLabel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import { QUIET_BUTTON, SMALL_BUTTON } from '../ui/styles'
import { useLightbox } from '../ui/lightboxContext'
import { cx, toneClasses, type Tone } from '../ui/tone'


/**
 * What the dungeon adds to this character, as modifiers for their own sheet.
 * A track with ranks but no bonus yet (Fortune Dice below rank 5) says when it starts.
 */
function trackEffects(c: Character): string[] {
  return STAT_TRACKS.flatMap((t) => {
    const rank = rankProgress(c.trackDevotions[t.id] ?? 0).rank
    if (rank === 0) return []
    return [effectAtRank(t, rank) ?? `${t.name}: first bonus at rank ${t.effect.every}`]
  })
}

/** Upgrades owned, e.g. ["Forge", "Extra Boon Slot 2"]. */
function upgradesOwned(c: Character): string[] {
  return UPGRADES.filter((u) => (c.upgrades[u.id] ?? 0) > 0).map((u) => (u.costs.length > 1 ? `${u.name} ${c.upgrades[u.id]}` : u.name))
}

interface Props {
  character: Character
  /** "dm": full controls and corrections; "player": spend only; "preview": read-only. */
  mode: 'dm' | 'player' | 'preview'
  /** DM buttons for the profile header (Edit, Clear lockout, Delete). */
  actions?: ReactNode
}

export function CharacterHub({ character: c, mode, actions }: Props) {
  const [visiting, setVisiting] = useState<'shrine' | 'markets' | 'echoes' | null>(null)
  const [savingClears, setSavingClears] = useState(false)
  const [clearsError, setClearsError] = useState<string | null>(null)
  async function adjustFullClears(delta: 1 | -1) {
    setClearsError(null)
    setSavingClears(true)
    try {
      await changeFullClears(c.id, delta)
    } catch {
      setClearsError('Could not save the full clear count. Please try again.')
    } finally {
      setSavingClears(false)
    }
  }
  const showArt = useLightbox()
  const portraitUrl = c.portrait ? artUrl('portraits', c.portrait) : null
  const effects = trackEffects(c)
  const owned = upgradesOwned(c)
  const honors = portraitHonors(c)
  const { overall } = mode === 'dm' ? echoCounts(c) : visibleEchoCounts(c)
  const canEdit = mode !== 'preview'
  const canCorrect = mode === 'dm'
  // The Shrine and Markets are closed while the character is in a run.
  const inRun = Boolean(c.activeRunId)
  const canSpend = mode !== 'preview' && !inRun
  const closedNote = inRun ? (
    <p className="m-0 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
      Closed while {c.name} is in a run. Spend here once the run ends.
    </p>
  ) : null

  return (
    <div className="flex flex-col gap-4">
      <Panel hero>
        <div className="flex flex-wrap items-start gap-4">
          {portraitUrl ? (
            <button
              type="button"
              onClick={() => showArt({ src: portraitUrl, title: c.name, subtitle: `${buildSummary({ ...c, ...buildOf(c) })} · Level ${c.level}` })}
              aria-label={`Enlarge ${c.name}'s portrait`}
              className="cursor-pointer rounded-full border-0 bg-transparent p-0"
            >
              <Portrait portrait={c.portrait} name={c.name} size="h-20 w-20" badgeSize={13} honors={honors} />
            </button>
          ) : (
            <Portrait portrait={c.portrait} name={c.name} size="h-20 w-20" badgeSize={13} honors={honors} />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="m-0 text-lg font-bold text-stone-50">{c.name}</h2>
              {c.lockoutDays > 0 && <Pill tone="rose">Locked out {c.lockoutDays} days</Pill>}
              {c.activeRunId && <Pill tone="sky">In a run</Pill>}
            </div>
            <p className="m-0 text-xs text-stone-300">
              {buildSummary({ ...c, ...buildOf(c) })} · Level {c.level} · PB +{proficiencyBonus(c.level)}
            </p>
            <p className="m-0 text-[0.6875rem] text-stone-500">
              {CASTER_TYPES.find((t) => t.id === c.casterType)?.label}
              {c.hasSummon && ' · summon/companion'}
              {mode === 'dm' && ` · ${c.playerEmail || 'no player assigned'}`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="purple" mono>
                {c.bankedQuantumBasalts} Quantum Basalts
              </Pill>
              <Pill tone="indigo" mono>
                {c.bankedDevotions} Devotions
              </Pill>
              <Pill mono>Deepest floor {c.deepestFloor || '–'}</Pill>
              <Pill tone={hasFullClear(c) ? 'amber' : 'stone'} mono title="Survived full clears: unlock the full-clear upgrades and the golden glow">
                Full clears {c.fullClears ?? 0}
              </Pill>
              {mode === 'dm' && (
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    disabled={savingClears || (c.fullClears ?? 0) === 0}
                    onClick={() => adjustFullClears(-1)}
                    aria-label={`Remove a full clear from ${c.name}`}
                  >
                    <Minus size={12} />
                  </button>
                  <button
                    type="button"
                    className={SMALL_BUTTON}
                    disabled={savingClears}
                    onClick={() => adjustFullClears(1)}
                    aria-label={`Add a full clear for ${c.name}`}
                  >
                    <Plus size={12} />
                  </button>
                </span>
              )}
            </div>
            {clearsError && <p className="m-0 text-xs text-rose-300">{clearsError}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
        </div>

        <LookPicker character={c} canEdit={canEdit} />

        <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/25 bg-stone-950/60 p-2.5">
          <SectionLabel>Active dungeon modifiers (add these to your sheet inside the Basalts)</SectionLabel>
          {effects.length ? (
            <div className="flex flex-wrap gap-1.5">
              {effects.map((e) => (
                <Pill key={e} tone="emerald">
                  {e}
                </Pill>
              ))}
            </div>
          ) : (
            <span className="text-[0.6875rem] text-stone-500">None yet: spend Devotions at the Basalt Shrine.</span>
          )}
          {owned.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[0.6875rem] text-stone-400">Upgrades:</span>
              {owned.map((u) => (
                <Pill key={u} tone="amber">
                  {u}
                </Pill>
              ))}
            </div>
          )}
        </div>

        <BuildPanel character={c} mode={mode} />
        <DraftPreferences character={c} canEdit={canEdit} />
        <CharacterLoot loot={c.loot} />
      </Panel>

      {visiting === 'shrine' ? (
        <Location
          artId="basalt-shrine"
          tone="indigo"
          icon={<Landmark size={16} />}
          title="The Basalt Shrine: stat tracks and Devotions"
          onLeave={() => setVisiting(null)}
        >
          {closedNote}
          <StatTracks character={c} canCorrect={canCorrect} canSpend={canSpend} />
        </Location>
      ) : visiting === 'markets' ? (
        <Location
          artId="basalt-markets"
          tone="amber"
          icon={<Store size={16} />}
          title="The Basalt Markets: permanent upgrades"
          onLeave={() => setVisiting(null)}
        >
          {closedNote}
          <UpgradeShop character={c} canCorrect={canCorrect} canSpend={canSpend} />
        </Location>
      ) : visiting === 'echoes' ? (
        <Location
          artId="basalt-lib"
          tone="emerald"
          icon={<Library size={16} />}
          title="Basalt Echoes: every boon you've held"
          onLeave={() => setVisiting(null)}
        >
          <BasaltEchoes character={c} canMark={canCorrect} />
        </Location>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LocationBanner
            artId="basalt-shrine"
            tone="indigo"
            icon={<Landmark size={16} />}
            title="The Basalt Shrine"
            text="Spend Devotions on stat tracks."
            badge={`${c.bankedDevotions} Devotions`}
            onVisit={() => setVisiting('shrine')}
          />
          <LocationBanner
            artId="basalt-markets"
            tone="amber"
            icon={<Store size={16} />}
            title="The Basalt Markets"
            text="Buy permanent upgrades with Quantum Basalts."
            badge={`${c.bankedQuantumBasalts} QB`}
            onVisit={() => setVisiting('markets')}
          />
          <LocationBanner
            artId="basalt-lib"
            tone="emerald"
            icon={<Library size={16} />}
            title="Basalt Echoes"
            text="Every boon, Evolution and Combination you've held, and the echoes still waiting."
            badge={`${overall.seen} of ${overall.total} seen`}
            className="md:col-span-2"
            onVisit={() => setVisiting('echoes')}
          />
        </div>
      )}
    </div>
  )
}

interface BannerProps {
  artId: string
  tone: Tone
  icon: ReactNode
  title: string
  text: string
  badge: string
  className?: string
  onVisit: () => void
}

/** A closed location: its art with a title, what it's for, and a Visit button. */
function LocationBanner({ artId, tone, icon, title, text, badge, className, onVisit }: BannerProps) {
  const url = artUrl('rooms', artId)
  return (
    <div className={cx('group relative overflow-hidden rounded-2xl border bg-stone-950', toneClasses[tone].border, className)}>
      {url && (
        <img
          src={url}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-stone-950/35" />
      <div className="relative flex min-h-40 flex-col justify-end gap-1.5 p-4">
        <strong className={cx('flex items-center gap-2 text-base drop-shadow-[0_1px_3px_rgb(0_0_0/0.9)]', toneClasses[tone].text)}>
          {icon} {title}
        </strong>
        <span className="text-xs text-stone-100 drop-shadow-[0_1px_2px_rgb(0_0_0/0.9)]">{text}</span>
        <span className="flex flex-wrap items-center gap-2">
          <Pill tone={tone} mono>
            {badge}
          </Pill>
          <button
            type="button"
            onClick={onVisit}
            className={cx('cursor-pointer rounded-lg border-0 px-3 py-1 text-xs font-bold', toneClasses[tone].button)}
          >
            Visit {title.replace(/^The /, '')}
          </button>
        </span>
      </div>
    </div>
  )
}

/** An open location: an art header, then its panel, with Leave. */
function Location({ artId, tone, icon, title, onLeave, children }: { artId: string; tone: Tone; icon: ReactNode; title: string; onLeave: () => void; children: ReactNode }) {
  const url = artUrl('rooms', artId)
  return (
    <section className={cx('relative overflow-hidden rounded-2xl border bg-stone-900/95 text-stone-100 shadow-2xl shadow-black/40', toneClasses[tone].border)}>
      {url && <img src={url} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-stone-950/75" />
      <div className="relative flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={cx('m-0 flex items-center gap-2 text-base font-bold', toneClasses[tone].text)}>
            {icon} {title}
          </h2>
          <button type="button" className={QUIET_BUTTON} onClick={onLeave}>
            <LogOut size={13} /> Leave
          </button>
        </div>
        {children}
      </div>
    </section>
  )
}
