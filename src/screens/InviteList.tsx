// DM screen for managing who may use the app.
// Each invite is a document in the "invites" collection, named by the
// lowercase email, with a role of "dm" or "player". firestore.rules makes
// sure only the DM can change this list.
import { useEffect, useState, type FormEvent } from 'react'
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import type { Role } from '../useAccess'
import { ConfirmButton } from '../ui/ConfirmButton'
import { Pill } from '../ui/Pill'
import { FIELD } from '../ui/styles'

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
    setError(null)
    try {
      await deleteDoc(doc(db, 'invites', target))
    } catch {
      setError('Could not remove that invite.')
    }
  }

  const me = myEmail.toLowerCase()

  return (
    <div className="space-y-3 text-sm">
      <p className="m-0 text-xs text-stone-400">
        Only these accounts can use the app. The email must match the account the player signs in with.
      </p>

      {invites === null && !error && <p className="m-0 text-stone-400">Loading…</p>}

      {invites && (
        <ul className="m-0 list-none space-y-1.5 p-0">
          {invites.map((invite) => (
            <li
              key={invite.email}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-800 bg-stone-950/80 px-3 py-2"
            >
              <span className="mr-auto min-w-0 truncate">{invite.email}</span>
              <Pill tone={invite.role === 'dm' ? 'rose' : 'sky'}>{invite.role === 'dm' ? 'DM' : 'Player'}</Pill>
              {invite.email === me ? (
                <span className="text-xs text-stone-500">you</span>
              ) : (
                <ConfirmButton confirmLabel="Yes, remove" onConfirm={() => removeInvite(invite.email)}>
                  Remove
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={addInvite}>
        <input
          type="email"
          placeholder="player@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email to invite"
          required
          className={`${FIELD} min-w-0 flex-1 basis-48`}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role" className={FIELD}>
          <option value="player">Player</option>
          <option value="dm">DM</option>
        </select>
        <button type="submit" className="cursor-pointer rounded-lg border-0 bg-amber-500 px-4 py-2 text-xs font-bold text-stone-950 hover:bg-amber-400">
          Add
        </button>
      </form>
      <p className="m-0 text-[11px] text-stone-500">Removing someone takes away their access right away.</p>

      {error && <p className="m-0 text-xs text-rose-300">{error}</p>}
    </div>
  )
}
