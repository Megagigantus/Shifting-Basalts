// A character's build in their hub: classes, training and Weapon Mastery,
// with an Edit button. Players edit their own build between runs; the DM can
// edit any time (design bible: Character setup). The DM reviews it at run setup.
import { useState } from 'react'
import { Swords } from 'lucide-react'
import { buildOf, type Character } from '../model/character'
import { saveBuild } from '../characterStore'
import { HOMEBREW, buildError, buildSummary, cleanBuild, trainingLabels, weaponBase, type BuildFields } from '../rules/build'
import { MIN_ENTRY_LEVEL } from '../rules/proficiency'
import { Pill } from '../ui/Pill'
import { SectionLabel } from '../ui/Panel'
import { PRIMARY_BUTTON, QUIET_BUTTON, SMALL_BUTTON } from '../ui/styles'
import { BuildEditor } from './BuildEditor'

/** A short read-only view of a build (also used in the DM's run lobby). */
export function BuildSummary({ character: c }: { character: Character }) {
  const b = buildOf(c)
  const full = { ...c, ...b }
  const { weapons, armor } = trainingLabels(full)
  return (
    <div className="flex flex-col gap-1 text-[0.6875rem] text-stone-300">
      <span className="text-xs font-semibold text-stone-100">{buildSummary(full)}</span>
      {c.classId === HOMEBREW && (
        <span>
          Homebrew tags: {b.homebrewTags.primary.join(', ') || 'none'} (×3) · {b.homebrewTags.secondary.join(', ') || 'none'} (×2)
        </span>
      )}
      <span>
        <span className="text-stone-500">Weapons:</span> {weapons.join(', ') || 'none'}
      </span>
      <span>
        <span className="text-stone-500">Armor:</span> {armor.join(', ') || 'none'}
      </span>
      <span>
        <span className="text-stone-500">Weapon Mastery:</span>{' '}
        {b.masteries.map((id) => `${weaponBase(id)?.name ?? id} (${weaponBase(id)?.mastery ?? '?'})`).join(', ') || 'none'}
      </span>
    </div>
  )
}

export function BuildPanel({ character: c, mode }: { character: Character; mode: 'dm' | 'player' | 'preview' }) {
  const [editing, setEditing] = useState<BuildFields | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inRun = Boolean(c.activeRunId)
  // Players change their build only between runs; the DM can correct it any time.
  const canEdit = mode === 'dm' || (mode === 'player' && !inRun)

  async function save() {
    if (!editing) return
    const build = cleanBuild(editing)
    const problem = buildError(build, MIN_ENTRY_LEVEL)
    if (problem) return setError(problem)
    setError(null)
    setSaving(true)
    try {
      await saveBuild(c.id, build)
      setEditing(null)
    } catch {
      setError('Could not save the build. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-stone-800 bg-stone-950/60 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SectionLabel className="mr-auto flex items-center gap-1.5">
          <Swords size={12} /> Build: classes, training and Weapon Mastery
        </SectionLabel>
        {inRun && mode === 'player' && <Pill tone="sky">Locked during the run</Pill>}
        {canEdit && !editing && (
          <button type="button" className={SMALL_BUTTON} onClick={() => setEditing({ ...buildOf(c), classId: c.classId, subclass: c.subclass })}>
            Edit build
          </button>
        )}
      </div>
      {editing ? (
        <>
          <BuildEditor value={editing} onChange={setEditing} disabled={saving} />
          {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY_BUTTON} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save build'}
            </button>
            <button type="button" className={QUIET_BUTTON} disabled={saving} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
          {mode === 'player' && <p className="m-0 text-[0.6875rem] text-stone-500">Your DM reviews your build when the run is set up.</p>}
        </>
      ) : (
        <BuildSummary character={c} />
      )}
    </div>
  )
}
