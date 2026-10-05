import type { Session } from '@supabase/supabase-js'
import type { ReactNode } from 'react'
import { createContext, use, useEffect, useState } from 'react'
import { getSupabase } from '~/api/Supabase'

type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface IAuthUser {
  id: string
  email: string
}

interface IAuthContext {
  status: AuthStatus
  user: IAuthUser | null
  signIn: (email: string, password: string) => Promise<void>
  /** Resolves to 'confirm' when the project requires email confirmation before the first sign-in. */
  signUp: (name: string, email: string, password: string) => Promise<'signedIn' | 'confirm'>
  signOut: () => Promise<void>
}

const AuthContext = createContext<IAuthContext | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IAuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    // The Supabase session (persisted in AsyncStorage) is the source of truth; it refreshes itself.
    const apply = (session: Session | null) => {
      setUser(session ? { id: session.user.id, email: session.user.email ?? '' } : null)
      setStatus(session ? 'signedIn' : 'signedOut')
    }
    const supabase = getSupabase()
    supabase.auth.getSession().then(({ data }) => apply(data.session)).catch(() => apply(null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => data.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      throw error
    }
  }

  async function signUp(name: string, email: string, password: string) {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    })
    if (error) {
      throw error
    }
    return data.session ? 'signedIn' : 'confirm'
  }

  async function signOut() {
    await getSupabase().auth.signOut()
  }

  return <AuthContext value={{ status, user, signIn, signUp, signOut }}>{children}</AuthContext>
}

export function useAuth(): IAuthContext {
  const context = use(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
