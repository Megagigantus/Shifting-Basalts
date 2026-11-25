import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { signOut } from 'firebase/auth'
import { auth, firebaseConfigured, usingEmulators } from './firebase'
import { useAccess } from './useAccess'
import { useActiveRun } from './runStore'
import { SignIn } from './screens/SignIn'
import { VerifyEmail } from './screens/VerifyEmail'
import { NotInvited } from './screens/NotInvited'
import { AppHeader } from './screens/AppHeader'
import { DM_TABS, type DmTab } from './screens/dmTabs'
import { Backdrop } from './screens/Backdrop'
import { Modal } from './ui/Modal'
import { cx } from './ui/tone'
import { artUrl } from './art'

// The big screens load only when first shown, so the sign-in page and a
// player's phone don't download DM tools (or the animation code) up front.
const InviteList = lazy(() => import('./screens/InviteList').then((m) => ({ default: m.InviteList })))
const Characters = lazy(() => import('./screens/Characters').then((m) => ({ default: m.Characters })))
const RunPanel = lazy(() => import('./screens/RunPanel').then((m) => ({ default: m.RunPanel })))
const PlayerHome = lazy(() => import('./screens/PlayerHome').then((m) => ({ default: m.PlayerHome })))
const PlayerPreview = lazy(() => import('./screens/PlayerPreview').then((m) => ({ default: m.PlayerPreview })))
const RunHistory = lazy(() => import('./screens/RunHistory').then((m) => ({ default: m.RunHistory })))
const TableViewer = lazy(() => import('./screens/TableViewer').then((m) => ({ default: m.TableViewer })))
const LoreDeck = lazy(() => import('./screens/LoreDeck').then((m) => ({ default: m.LoreDeck })))
const TableDisplay = lazy(() => import('./screens/TableDisplay').then((m) => ({ default: m.TableDisplay })))
const MomentIndicator = lazy(() => import('./moments/MomentIndicator').then((m) => ({ default: m.MomentIndicator })))

const loadingLine = <p className="py-8 text-center text-sm text-stone-400">Loading…</p>

const LOGO_BANNER = artUrl('logo', 'logo-banner')

const TAB_KEY = 'sb-dm-tab'

/** The DM's last tab on this device (a convenience; falls back to Run). */
function savedTab(): DmTab {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    return DM_TABS.some((t) => t.id === saved) ? (saved as DmTab) : 'run'
  } catch {
    return 'run'
  }
}

function saveTab(tab: DmTab) {
  try {
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    // Storage blocked (private window): the tab just isn't remembered.
  }
}

const signOutNow = () => {
  if (auth) signOut(auth)
}

function App() {
  const { access, recheck } = useAccess()

  if (access.status === 'invited') {
    return <SignedIn email={access.user.email ?? ''} role={access.role} />
  }

  // Everything before someone is fully signed in: a centered card.
  let body: ReactNode
  if (!firebaseConfigured) body = <p className="text-sm text-stone-300">Firebase isn't set up yet (see .env.example).</p>
  else if (access.status === 'loading') body = <p className="text-center text-sm text-stone-400">Checking your invite…</p>
  else if (access.status === 'signedOut') body = <SignIn />
  else if (access.status === 'unverified') body = <VerifyEmail user={access.user} recheck={recheck} />
  else body = <NotInvited email={access.user.email ?? ''} onSignOut={signOutNow} />

  return (
    <>
      <Backdrop inRun={false} />
      <main className="mx-auto max-w-md px-4 py-12 sm:py-20">
        <div className="mb-6 text-center">
          <h1 className="m-0 text-3xl font-bold text-amber-400">
            {LOGO_BANNER ? (
              <img src={LOGO_BANNER} alt="The Shifting Basalts" className="block w-full rounded-xl border border-stone-800 shadow-lg shadow-black/50" />
            ) : (
              'Shifting Basalts'
            )}
          </h1>
          <p className="m-0 mt-1 text-xs text-stone-400">Dungeon tracker · invite-only table access</p>
          {usingEmulators && (
            <p className="m-0 mt-3 text-xs font-semibold text-amber-300">Local test mode: using the emulators on this computer, not real data.</p>
          )}
        </div>
        {body}
      </main>
    </>
  )
}

function SignedIn({ email, role }: { email: string; role: 'dm' | 'player' }) {
  const { state } = useActiveRun()
  const [tab, setTab] = useState<DmTab>(savedTab)
  const [playerView, setPlayerView] = useState(false)
  const [tableView, setTableView] = useState(false)
  const [invitesOpen, setInvitesOpen] = useState(false)

  const isDm = role === 'dm'
  const chooseTab = (next: DmTab) => {
    setTab(next)
    saveTab(next)
  }

  // Players get slightly larger text on phones (see .player-ui in index.css).
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('player-ui', !isDm)
    return () => root.classList.remove('player-ui')
  }, [isDm])

  if (isDm && tableView) {
    return (
      <>
        <Backdrop inRun={state !== null} />
        <Suspense fallback={loadingLine}>
          <TableDisplay state={state} onExit={() => setTableView(false)} />
        </Suspense>
      </>
    )
  }

  // Wide screens: the Run tab (main column + party sidebar), Characters (roster + hub) and the player screens.
  const wide = isDm ? playerView || tab === 'run' || tab === 'characters' : true

  return (
    <>
      <Backdrop inRun={state !== null} />
      <AppHeader
        email={email}
        role={role}
        testMode={usingEmulators}
        onSignOut={signOutNow}
        dm={
          isDm
            ? {
                tab,
                onTab: chooseTab,
                playerView,
                onPlayerView: setPlayerView,
                onTableView: () => setTableView(true),
                onInvites: () => setInvitesOpen(true),
              }
            : undefined
        }
      />

      {isDm && state && state.run.status === 'active' && (
        <Suspense fallback={null}>
          <MomentIndicator
            runId={state.run.id}
            names={Object.fromEntries(state.players.map((p) => [p.characterId, p.name]))}
          />
        </Suspense>
      )}

      {/* The old panels keep their own styles until each step redesigns them. */}
      <main className={cx('mx-auto px-4 pb-16', wide ? 'max-w-7xl' : 'max-w-5xl')}>
        <Suspense fallback={loadingLine}>
          {!isDm && <PlayerHome email={email} />}
          {isDm && playerView && <PlayerPreview />}
          {isDm && !playerView && (
            <>
              {tab === 'run' && <RunPanel />}
              {tab === 'characters' && <Characters />}
              {tab === 'history' && <RunHistory canDelete />}
              {tab === 'tables' && <TableViewer />}
              {tab === 'lore' && <LoreDeck />}
            </>
          )}
        </Suspense>
      </main>

      {isDm && invitesOpen && (
        <Modal title="Invites" onClose={() => setInvitesOpen(false)}>
          <Suspense fallback={loadingLine}>
            <InviteList myEmail={email} />
          </Suspense>
        </Modal>
      )}
    </>
  )
}

export default App
