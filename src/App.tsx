import { useState, type ReactNode } from 'react'
import { signOut } from 'firebase/auth'
import { auth, firebaseConfigured, usingEmulators } from './firebase'
import { useAccess } from './useAccess'
import { useActiveRun } from './runStore'
import { SignIn } from './screens/SignIn'
import { VerifyEmail } from './screens/VerifyEmail'
import { NotInvited } from './screens/NotInvited'
import { InviteList } from './screens/InviteList'
import { Characters } from './screens/Characters'
import { RunPanel } from './screens/RunPanel'
import { PlayerHome } from './screens/PlayerHome'
import { PlayerPreview } from './screens/PlayerPreview'
import { RunHistory } from './screens/RunHistory'
import { TableViewer } from './screens/TableViewer'
import { AppHeader } from './screens/AppHeader'
import { DM_TABS, type DmTab } from './screens/dmTabs'
import { Backdrop } from './screens/Backdrop'
import { Modal } from './ui/Modal'
import { cx } from './ui/tone'

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
          <h1 className="m-0 text-3xl font-bold text-amber-400">Shifting Basalts</h1>
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
  const [invitesOpen, setInvitesOpen] = useState(false)

  const isDm = role === 'dm'
  const chooseTab = (next: DmTab) => {
    setTab(next)
    saveTab(next)
  }

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
            ? { tab, onTab: chooseTab, playerView, onPlayerView: setPlayerView, onInvites: () => setInvitesOpen(true) }
            : undefined
        }
      />

      {/* The old panels keep their own styles until each step redesigns them.
          The DM's Run tab is wider, for the main column plus the party sidebar. */}
      <main className={cx('mx-auto px-4 pb-16', isDm && !playerView && tab === 'run' ? 'max-w-7xl' : 'max-w-5xl')}>
        {!isDm && <PlayerHome email={email} />}
        {isDm && playerView && <PlayerPreview />}
        {isDm && !playerView && (
          <>
            {tab === 'run' && <RunPanel />}
            {tab === 'characters' && <Characters />}
            {tab === 'history' && <RunHistory />}
            {tab === 'tables' && <TableViewer />}
          </>
        )}
      </main>

      {isDm && invitesOpen && (
        <Modal title="Invites" onClose={() => setInvitesOpen(false)}>
          <InviteList myEmail={email} />
        </Modal>
      )}
    </>
  )
}

export default App
