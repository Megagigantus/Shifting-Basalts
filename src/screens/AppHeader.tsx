// The sticky bar at the top of every signed-in screen: title, the DM's tabs
// and tools, who is signed in, and Sign out.
import { useEffect, useState, type ReactNode } from 'react'
import { BookOpen, Eye, FlaskConical, ClockArrowLeft, Link2, LogOut, Shield, Swords, User, Users } from 'lucide-react'
import { cx } from '../ui/tone'
import { DM_TABS, type DmTab } from './dmTabs'

const TAB_ICONS: Record<DmTab, ReactNode> = {
  run: <Swords size={14} />,
  characters: <Users size={14} />,
  history: <ClockArrowLeft size={14} />,
  tables: <BookOpen size={14} />,
}

const SMALL_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-colors'
const QUIET = 'border-stone-700 bg-stone-900 text-stone-300 hover:bg-stone-800'

interface DmControls {
  tab: DmTab
  onTab: (tab: DmTab) => void
  /** True while the DM is looking at the player view. */
  playerView: boolean
  onPlayerView: (on: boolean) => void
  onInvites: () => void
}

interface Props {
  email?: string | null
  role?: 'dm' | 'player'
  /** Local emulators instead of the real database. */
  testMode?: boolean
  dm?: DmControls
  onSignOut?: () => void
}

export function AppHeader({ email, role, testMode, dm, onSignOut }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-800 bg-stone-900/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="mr-auto min-w-0">
          <div className="text-lg font-bold leading-tight text-amber-400">Shifting Basalts</div>
          <div className="text-[11px] text-stone-400">Dungeon tracker &amp; generator</div>
        </div>

        {dm && !dm.playerView && (
          <nav aria-label="Sections" className="order-last flex w-full gap-1 overflow-x-auto rounded-xl border border-stone-800 bg-stone-950/80 p-1 md:order-none md:w-auto">
            {DM_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={dm.tab === t.id ? 'page' : undefined}
                onClick={() => dm.onTab(t.id)}
                className={cx(
                  SMALL_BUTTON,
                  'border-transparent bg-transparent',
                  dm.tab === t.id ? 'border-amber-500/40 bg-amber-500/20 text-amber-300' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200',
                )}
              >
                {TAB_ICONS[t.id]}
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {testMode && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200" title="Using the emulators on this computer, not real data.">
              <FlaskConical size={12} /> Local test mode
            </span>
          )}

          {dm ? (
            <>
              <div role="group" aria-label="View" className="inline-flex rounded-lg border border-stone-800 bg-stone-950/80 p-0.5">
                <button
                  type="button"
                  aria-pressed={!dm.playerView}
                  onClick={() => dm.onPlayerView(false)}
                  className={cx(SMALL_BUTTON, 'border-transparent bg-transparent', !dm.playerView ? 'bg-rose-500/20 text-rose-200 border-rose-500/40' : 'text-stone-400 hover:text-stone-200')}
                >
                  <Shield size={13} /> DM
                </button>
                <button
                  type="button"
                  aria-pressed={dm.playerView}
                  onClick={() => dm.onPlayerView(true)}
                  className={cx(SMALL_BUTTON, 'border-transparent bg-transparent', dm.playerView ? 'bg-sky-500/20 text-sky-200 border-sky-500/40' : 'text-stone-400 hover:text-stone-200')}
                >
                  <Eye size={13} /> Player view
                </button>
              </div>
              <button type="button" onClick={dm.onInvites} className={cx(SMALL_BUTTON, 'border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20')}>
                <Users size={13} /> Invites
              </button>
              <CopyLinkButton />
            </>
          ) : (
            role === 'player' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-sky-200">
                <User size={12} /> Player
              </span>
            )
          )}

          {email && <span className="hidden text-[11px] text-stone-400 xl:inline">{email}</span>}
          {onSignOut && (
            <button type="button" onClick={onSignOut} className={cx(SMALL_BUTTON, QUIET)}>
              <LogOut size={13} /> Sign out
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

/** Copies the app's address so the DM can send it to players. */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin)
      setCopied(true)
    } catch {
      window.prompt('Copy this link for your players:', window.location.origin)
    }
  }

  return (
    <button type="button" onClick={copy} title="Copy the app's link to send to players" className={cx(SMALL_BUTTON, QUIET)}>
      <Link2 size={13} /> {copied ? 'Copied!' : 'Player link'}
    </button>
  )
}
