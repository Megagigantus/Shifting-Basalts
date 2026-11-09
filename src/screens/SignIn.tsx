// Sign-in screen: Google, or email and password for players who don't use
// Google. Creating an account sends a verification email; the invite list
// still decides who gets in.
import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../firebase'
import { authErrorMessage, MIN_PASSWORD } from '../authErrors'

type Mode = 'signIn' | 'create' | 'reset'

export function SignIn() {
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
    setConfirm('')
  }

  async function google() {
    if (!auth) return
    setError(null)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      const code = (err as { code?: string }).code
      // Closing the popup isn't an error worth showing.
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError('Google sign-in failed. Please try again.')
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!auth) return
    const cleanEmail = email.trim()
    setError(null)
    setNotice(null)

    if (mode === 'create') {
      if (password.length < MIN_PASSWORD) return setError(`Use a password of at least ${MIN_PASSWORD} characters.`)
      if (password !== confirm) return setError('The two passwords don\'t match.')
    }

    setBusy(true)
    try {
      if (mode === 'signIn') {
        await signInWithEmailAndPassword(auth, cleanEmail, password)
      } else if (mode === 'create') {
        const { user } = await createUserWithEmailAndPassword(auth, cleanEmail, password)
        await sendEmailVerification(user)
      } else {
        await sendPasswordResetEmail(auth, cleanEmail)
        // Same message whether or not the account exists, so the form can't
        // be used to discover who has an account.
        setNotice(`If there's an account for ${cleanEmail}, a password reset link is on its way. Check your inbox and spam folder.`)
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sign-in">
      <p>This app is invite only. Sign in with the email your DM invited.</p>

      <button type="button" onClick={google}>
        Sign in with Google
      </button>

      <div className="divider">
        <span>or use your email</span>
      </div>

      <form className="sign-in-form" onSubmit={submit}>
        <h3>{mode === 'signIn' ? 'Sign in with email' : mode === 'create' ? 'Create an account' : 'Reset your password'}</h3>
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {mode !== 'reset' && (
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
        )}
        {mode === 'create' && (
          <label>
            Password again
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <span className="hint">At least {MIN_PASSWORD} characters.</span>
          </label>
        )}

        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}

        <button type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : mode === 'create' ? 'Create account' : 'Send reset link'}
        </button>

        <div className="sign-in-links">
          {mode !== 'signIn' && (
            <button type="button" className="link" onClick={() => switchMode('signIn')}>
              Back to sign in
            </button>
          )}
          {mode === 'signIn' && (
            <>
              <button type="button" className="link" onClick={() => switchMode('create')}>
                First time? Create an account
              </button>
              <button type="button" className="link" onClick={() => switchMode('reset')}>
                Forgot password?
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
