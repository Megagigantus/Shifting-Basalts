// Sign-in screen: Google, or email and password for players who don't use
// Google. Creating an account sends a verification email; the invite list
// still decides who gets in.
import { useState, type FormEvent, type ReactNode } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
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
import { cx } from '../ui/tone'
import { AUTH_CARD, FIELD, FIELD_LABEL, LINK_BUTTON, PRIMARY_BUTTON } from '../ui/styles'

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

  const tab = (target: Mode, label: string, icon: ReactNode) => (
    <button
      type="button"
      aria-pressed={mode === target}
      onClick={() => switchMode(target)}
      className={cx(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer',
        mode === target
          ? 'border-amber-500/40 bg-amber-500/20 text-amber-200'
          : 'border-transparent bg-transparent text-stone-400 hover:bg-stone-800 hover:text-stone-200',
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className={AUTH_CARD}>
      <p className="m-0 text-xs text-stone-400">This app is invite only. Sign in with the email your DM invited.</p>

      {mode !== 'reset' && (
        <div role="group" aria-label="Sign in or create an account" className="flex gap-1 rounded-xl border border-stone-800 bg-stone-950/80 p-1">
          {tab('signIn', 'Sign in', <LogIn size={13} />)}
          {tab('create', 'Create account', <UserPlus size={13} />)}
        </div>
      )}

      <button
        type="button"
        onClick={google}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-0 bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-white cursor-pointer"
      >
        <GoogleMark /> Continue with Google
      </button>

      <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
        <span className="h-px flex-1 bg-stone-800" />
        or use your email
        <span className="h-px flex-1 bg-stone-800" />
      </div>

      <form className="space-y-3" onSubmit={submit}>
        <h2 className="m-0 text-sm font-bold text-stone-200">
          {mode === 'signIn' ? 'Sign in with email' : mode === 'create' ? 'Create an account' : 'Reset your password'}
        </h2>
        <label className={FIELD_LABEL}>
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`${FIELD} w-full`}
          />
        </label>
        {mode !== 'reset' && (
          <label className={FIELD_LABEL}>
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`${FIELD} w-full`}
            />
          </label>
        )}
        {mode === 'create' && (
          <label className={FIELD_LABEL}>
            <span>Password again</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={`${FIELD} w-full`}
            />
            <span className="block text-[11px] font-normal text-stone-500">At least {MIN_PASSWORD} characters.</span>
          </label>
        )}

        {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
        {notice && <p className="m-0 text-xs text-emerald-300">{notice}</p>}

        <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
          {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : mode === 'create' ? 'Create account' : 'Send reset link'}
        </button>

        <div className="flex flex-wrap justify-center gap-4">
          {mode === 'reset' ? (
            <button type="button" className={LINK_BUTTON} onClick={() => switchMode('signIn')}>
              Back to sign in
            </button>
          ) : (
            mode === 'signIn' && (
              <button type="button" className={LINK_BUTTON} onClick={() => switchMode('reset')}>
                Forgot password?
              </button>
            )
          )}
        </div>
      </form>
    </div>
  )
}

/** Google's "G", drawn inline so no image request is needed. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
