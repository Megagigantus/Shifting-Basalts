import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'
import { auth, firebaseConfigured } from './firebase'
import { useAccess } from './useAccess'
import { InviteList } from './screens/InviteList'
import { Characters } from './screens/Characters'
import { RunPanel } from './screens/RunPanel'

function App() {
  const access = useAccess()
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    if (!auth) return
    setError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      const code = (err as { code?: string }).code
      // Closing the popup isn't an error worth showing.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Sign-in failed. Please try again.')
      }
    }
  }

  const signOutButton = (
    <button type="button" onClick={() => auth && signOut(auth)}>
      Sign out
    </button>
  )

  return (
    <main className="placeholder">
      <h1>Shifting Basalts</h1>

      {!firebaseConfigured && <p>Firebase isn't set up yet (see .env.example).</p>}

      {firebaseConfigured && access.status === 'loading' && <p>Checking your invite…</p>}

      {firebaseConfigured && access.status === 'signedOut' && (
        <>
          <p>This app is invite only. Sign in with the Google account your DM invited.</p>
          <button type="button" onClick={signIn}>
            Sign in with Google
          </button>
          {error && <p className="error">{error}</p>}
        </>
      )}

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
              <InviteList myEmail={access.user.email ?? ''} />
            </>
          ) : (
            <p className="status">Tracker coming soon.</p>
          )}
        </>
      )}
    </main>
  )
}

export default App
