// Plain-language messages for Firebase sign-in errors, shared by the sign-in screens.

export const MIN_PASSWORD = 8

/** Plain-language messages for Firebase's error codes. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string }).code ?? ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.'
    case 'auth/email-already-in-use':
      return 'There\'s already an account with this email. Sign in instead, or use "Forgot password?".'
    case 'auth/weak-password':
      return `Use a password of at least ${MIN_PASSWORD} characters.`
    case 'auth/invalid-email':
      return 'That doesn\'t look like an email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'auth/operation-not-allowed':
      return 'Email sign-in isn\'t switched on yet. Ask your DM.'
    case 'auth/network-request-failed':
      return 'Couldn\'t reach the server. Check your connection and try again.'
    default:
      return 'Something went wrong. Please try again.'
  }
}
