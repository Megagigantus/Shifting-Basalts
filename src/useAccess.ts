// Tracks who is signed in and what the invite list says they can do.
// The real protection is firestore.rules; this only decides which screen to show.
import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

export type Role = 'dm' | 'player'

export type Access =
  | { status: 'loading' }
  | { status: 'signedOut' }
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

export function useAccess(): Access {
  const [access, setAccess] = useState<Access>(
    auth ? { status: 'loading' } : { status: 'signedOut' },
  )

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAccess({ status: 'signedOut' })
        return
      }
      setAccess({ status: 'loading' })
      const role = await lookUpRole(user)
      setAccess(role ? { status: 'invited', user, role } : { status: 'notInvited', user })
    })
  }, [])

  return access
}
