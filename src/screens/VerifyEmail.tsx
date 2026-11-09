// Shown after creating an email-and-password account, until the player clicks
// the link in their verification email.
import { useState } from 'react'
import { sendEmailVerification, signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import { authErrorMessage } from '../authErrors'

export function VerifyEmail({ user, recheck }: { user: User; recheck: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  async function checkAgain() {
    setBusy(true)
    setMessage(null)
    try {
      await recheck()
      // If still unverified, this screen stays up; say so.
      if (!auth?.currentUser?.emailVerified) {
        setMessage({ text: 'Not verified yet. Click the link in the email, then try again.', isError: true })
      }
    } catch (err) {
      setMessage({ text: authErrorMessage(err), isError: true })
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    setMessage(null)
    try {
      await sendEmailVerification(user)
      setMessage({ text: 'Sent another verification email.', isError: false })
    } catch (err) {
      setMessage({ text: authErrorMessage(err), isError: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sign-in">
      <h3>Check your email</h3>
      <p>
        We sent a verification link to <strong>{user.email}</strong>. Click it, then come back here and press the
        button below. If it's not in your inbox, check your spam folder.
      </p>
      <div className="row-actions wrap">
        <button type="button" disabled={busy} onClick={checkAgain}>
          I've verified my email
        </button>
        <button type="button" disabled={busy} onClick={resend}>
          Resend the email
        </button>
        <button type="button" className="quiet" disabled={busy} onClick={() => auth && signOut(auth)}>
          Sign out
        </button>
      </div>
      {message && <p className={message.isError ? 'error' : 'notice'}>{message.text}</p>}
    </div>
  )
}
