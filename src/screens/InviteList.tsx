// DM screen for managing who may use the app.
// Each invite is a document in the "invites" collection, named by the
// lowercase email, with a role of "dm" or "player". firestore.rules makes
// sure only the DM can change this list.
import { useEffect, useState, type FormEvent } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Role } from '../useAccess'

interface Invite {
  email: string
  role: Role
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteList({ myEmail }: { myEmail: string }) {
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('player')
  const [error, setError] = useState<string | null>(null)

  // Keep the list in sync with the database.
  useEffect(() => {
    if (!db) return
    return onSnapshot(
      collection(db, 'invites'),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ email: d.id, role: d.data().role as Role }))
        list.sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'dm' ? -1 : 1))
        setInvites(list)
      },
      () => setError('Could not load the invite list.'),
    )
  }, [])

  async function addInvite(event: FormEvent) {
    event.preventDefault()
    if (!db) return
    const cleaned = email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(cleaned)) {
      setError('That doesn\'t look like an email address.')
      return
    }
    setError(null)
    try {
      await setDoc(doc(db, 'invites', cleaned), { role })
      setEmail('')
      setRole('player')
    } catch {
      setError('Could not save that invite.')
    }
  }

  async function removeInvite(target: string) {
    if (!db) return
    if (!window.confirm(`Remove ${target} from the invite list? They'll lose access right away.`)) return
    setError(null)
    try {
      await deleteDoc(doc(db, 'invites', target))
    } catch {
      setError('Could not remove that invite.')
    }
  }

  const me = myEmail.toLowerCase()

  return (
    <section className="panel">
      <h2>Invite list</h2>
      <p className="hint">
        Only these Google accounts can use the app. The email must match the account
        the player signs in with.
      </p>

      {invites === null && !error && <p>Loading…</p>}

      {invites && (
        <ul className="invite-list">
          {invites.map((invite) => (
            <li key={invite.email}>
              <span className="invite-email">{invite.email}</span>
              <span className="tag">{invite.role === 'dm' ? 'DM' : 'Player'}</span>
              {invite.email === me ? (
                <span className="hint">you</span>
              ) : (
                <button type="button" onClick={() => removeInvite(invite.email)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="invite-form" onSubmit={addInvite}>
        <input
          type="email"
          placeholder="player@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email to invite"
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
          <option value="player">Player</option>
          <option value="dm">DM</option>
        </select>
        <button type="submit">Add</button>
      </form>

      {error && <p className="error">{error}</p>}
    </section>
  )
}
