// Shown after creating an email-and-password account, until the player clicks
// the link in their verification email.
import { useState } from 'react'
import { sendEmailVerification, signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import { authErrorMessage } from '../authErrors'
import { LogOut, MailCheck } from 'lucide-react'
import { AUTH_CARD, PRIMARY_BUTTON, QUIET_BUTTON } from '../ui/styles'

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
    <div className={AUTH_CARD}>
      <h2 className="m-0 flex items-center gap-2 text-sm font-bold text-amber-300">
        <MailCheck size={16} /> Check your email
      </h2>
      <p className="m-0 text-sm text-stone-300">
        We sent a verification link to <strong className="text-stone-100">{user.email}</strong>. Click it, then come back here and
        press the button below. If it's not in your inbox, check your spam folder.
      </p>
      <button type="button" disabled={busy} onClick={checkAgain} className={PRIMARY_BUTTON}>
        I've verified my email
      </button>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={resend} className={`${QUIET_BUTTON} flex-1`}>
          Resend the email
        </button>
        <button type="button" disabled={busy} onClick={() => auth && signOut(auth)} className={`${QUIET_BUTTON} flex-1`}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
      {message && <p className={message.isError ? "m-0 text-xs text-rose-300" : "m-0 text-xs text-emerald-300"}>{message.text}</p>}
    </div>
  )
}
