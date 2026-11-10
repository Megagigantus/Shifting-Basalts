import { signOut } from 'firebase/auth'
import { auth, firebaseConfigured, usingEmulators } from './firebase'
import { useAccess } from './useAccess'
import { SignIn } from './screens/SignIn'
import { VerifyEmail } from './screens/VerifyEmail'
import { InviteList } from './screens/InviteList'
import { Characters } from './screens/Characters'
import { RunPanel } from './screens/RunPanel'
import { PlayerHome } from './screens/PlayerHome'
import { PlayerPreview } from './screens/PlayerPreview'
import { RunHistory } from './screens/RunHistory'

function App() {
  const { access, recheck } = useAccess()

  const signOutButton = (
    <button type="button" onClick={() => auth && signOut(auth)}>
      Sign out
    </button>
  )

  return (
    <main className="placeholder">
      <h1>Shifting Basalts</h1>
      {usingEmulators && (
        <p className="warning">Local test mode: using the emulators on this computer, not real data.</p>
      )}

      {!firebaseConfigured && <p>Firebase isn't set up yet (see .env.example).</p>}

      {firebaseConfigured && access.status === 'loading' && <p>Checking your invite…</p>}

      {firebaseConfigured && access.status === 'signedOut' && <SignIn />}

      {access.status === 'unverified' && <VerifyEmail user={access.user} recheck={recheck} />}

      {access.status === 'notInvited' && (
        <>
          <p>
            {access.user.email} isn't on the invite list. Ask your DM to add this exact
            email, then sign in again.
          </p>
          {signOutButton}
        </>
      )}

      {access.status === 'invited' && (
        <>
          <p>
            Signed in as {access.user.email} ({access.role === 'dm' ? 'DM' : 'Player'}).
          </p>
          {signOutButton}
          {access.role === 'dm' ? (
            <>
              <RunPanel />
              <Characters />
              <RunHistory />
              <InviteList myEmail={access.user.email ?? ''} />
              <PlayerPreview />
            </>
          ) : (
            <PlayerHome email={access.user.email ?? ''} />
          )}
        </>
      )}
    </main>
  )
}

export default App
