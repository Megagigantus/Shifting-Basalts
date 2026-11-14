// Shown when someone signs in with an account that isn't on the invite list.
import { LogOut, ShieldX } from 'lucide-react'
import { AUTH_CARD_BASE, QUIET_BUTTON } from '../ui/styles'

export function NotInvited({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  return (
    <div className={`${AUTH_CARD_BASE} border-rose-500/40`}>
      <h2 className="m-0 flex items-center gap-2 text-sm font-bold text-rose-300">
        <ShieldX size={16} /> Invite required
      </h2>
      <p className="m-0 text-sm text-stone-300">
        <strong className="text-stone-100">{email}</strong> isn't on the invite list. Ask your DM to add this exact email,
        then sign in again.
      </p>
      <button type="button" onClick={onSignOut} className={`${QUIET_BUTTON} w-full`}>
        <LogOut size={13} /> Sign out
      </button>
    </div>
  )
}
