// Tracks who is signed in and what the invite list says they can do.
// The real protection is firestore.rules; this only decides which screen to show.
import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

export type Role = 'dm' | 'player'

export type Access =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** Signed up with email and password, but hasn't clicked the verification link yet. */
  | { status: 'unverified'; user: User }
  | { status: 'notInvited'; user: User }
  | { status: 'invited'; user: User; role: Role }

async function lookUpRole(user: User): Promise<Role | null> {
  if (!db || !user.email) return null
  try {
    const invite = await getDoc(doc(db, 'invites', user.email.toLowerCase()))
    const role = invite.data()?.role
    return role === 'dm' || role === 'player' ? role : null
  } catch {
    // The rules refuse the lookup for unverified emails; treat as not invited.
    return null
  }
}

async function accessFor(user: User | null): Promise<Access> {
  if (!user) return { status: 'signedOut' }
  // Google accounts arrive verified; email-and-password accounts need the link clicked.
  if (!user.emailVerified) return { status: 'unverified', user }
  const role = await lookUpRole(user)
  return role ? { status: 'invited', user, role } : { status: 'notInvited', user }
}

export function useAccess(): { access: Access; recheck: () => Promise<void> } {
  const [access, setAccess] = useState<Access>(auth ? { status: 'loading' } : { status: 'signedOut' })

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async (user) => {
      setAccess({ status: 'loading' })
      setAccess(await accessFor(user))
    })
  }, [])

  /**
   * Re-read the signed-in account, e.g. after the player clicks their
   * verification link. Refreshing the token makes the database see the
   * newly verified email too.
   */
  const recheck = useCallback(async () => {
    const user = auth?.currentUser
    if (!user) return
    await user.reload()
    if (user.emailVerified) await user.getIdToken(true)
    setAccess(await accessFor(user))
  }, [])

  return { access, recheck }
}
