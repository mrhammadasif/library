import type { ReactNode } from 'react'
import { createContext, use } from 'react'
import { authClient } from '~/api/Auth'
import { signInWithGoogleNative } from '~/auth/GoogleSignIn'

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface IAuthUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
}

interface IAuthContext {
  status: AuthStatus
  user: IAuthUser | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  /** Credential Manager on Android: one tap for saved Google accounts, the account sheet otherwise. */
  signInWithGoogle: () => Promise<'signedIn' | 'cancelled'>
  /** type 'email-verification' | 'sign-in' | 'forget-password' */
  sendCode: (email: string, type: 'email-verification' | 'sign-in' | 'forget-password') => Promise<void>
  verifyEmail: (email: string, otp: string) => Promise<void>
  signInWithCode: (email: string, otp: string) => Promise<void>
  resetPassword: (email: string, otp: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Re-reads the session (e.g. after verifying the email). */
  refresh: () => Promise<void>
}

const AuthContext = createContext<IAuthContext | null>(null)

/** Better Auth's results are `{ error }` rather than throws; surface them as exceptions for the screens. */
async function check<T extends { error: { message?: string, code?: string, status?: number } | null }>(promise: Promise<T>): Promise<T> {
  const result = await promise
  if (result.error) {
    throw Object.assign(new Error(result.error.message ?? 'Something went wrong'), { code: result.error.code, status: result.error.status })
  }
  return result
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const raw = session.data?.user
  const user: IAuthUser | null = raw ? { id: raw.id, email: raw.email, name: raw.name, emailVerified: raw.emailVerified } : null
  const status: AuthStatus = session.isPending ? 'loading' : user ? 'signedIn' : 'signedOut'

  const value: IAuthContext = {
    status,
    user,
    signIn: async (email, password) => { await check(authClient.signIn.email({ email: email.trim(), password })) },
    signUp: async (name, email, password) => { await check(authClient.signUp.email({ name: name.trim(), email: email.trim(), password })) },
    signInWithGoogle: async () => {
      const idToken = await signInWithGoogleNative()
      if (!idToken) {
        return 'cancelled'
      }
      await check(authClient.signIn.social({ provider: 'google', idToken: { token: idToken } }))
      return 'signedIn'
    },
    sendCode: async (email, type) => { await check(authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type })) },
    verifyEmail: async (email, otp) => {
      await check(authClient.emailOtp.verifyEmail({ email: email.trim(), otp: otp.trim() }))
      await session.refetch()
    },
    signInWithCode: async (email, otp) => { await check(authClient.signIn.emailOtp({ email: email.trim(), otp: otp.trim() })) },
    resetPassword: async (email, otp, password) => { await check(authClient.emailOtp.resetPassword({ email: email.trim(), otp: otp.trim(), password })) },
    signOut: async () => { await authClient.signOut() },
    refresh: async () => { await session.refetch() },
  }
  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): IAuthContext {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
