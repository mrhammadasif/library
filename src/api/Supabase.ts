import type { SupabaseClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, FunctionsHttpError } from '@supabase/supabase-js'
import { AppState } from 'react-native'

let client: SupabaseClient | null = null

/** The Supabase client, created on first use. The session persists in AsyncStorage. */
export function getSupabase(): SupabaseClient {
  if (client) {
    return client
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY
  if (!url || !key) {
    throw new Error('Supabase is not configured (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY)')
  }
  const created = createClient(url, key, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  })
  // Supabase's recommended React Native setup: refresh tokens only while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      created.auth.startAutoRefresh()
    }
    else {
      created.auth.stopAutoRefresh()
    }
  })
  client = created
  return created
}

/** Error from an edge function, carrying its `code` (e.g. ai_not_configured). */
export class FunctionError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
  }
}

export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response
      const payload = await response.json().catch(() => ({})) as { code?: string, message?: string }
      throw new FunctionError(payload.code ?? 'error', payload.message ?? error.message, response.status)
    }
    throw error
  }
  return data as T
}

/** Throws the PostgREST error when present, else returns data. */
export function unwrap<T>({ data, error }: { data: T | null, error: unknown }): T {
  if (error) {
    throw error
  }
  return data as T
}

/** Public URL of a stored cover, or the external cover URL. */
export function coverUri(coverPath: string | null, coverUrl: string | null): string | null {
  if (coverPath) {
    return getSupabase().storage.from('covers').getPublicUrl(coverPath).data.publicUrl
  }
  return coverUrl
}
