import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

/**
 * Verifies the caller's JWT and library membership, returning a service-role client. Callers must scope every
 * query to the verified library: the service role bypasses RLS.
 */
export async function memberContext(req: Request, libraryId: unknown): Promise<{ admin: SupabaseClient, userId: string }> {
  if (typeof libraryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(libraryId)) {
    throw new HttpError(400, 'bad_request', 'libraryId is required')
  }
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    throw new HttpError(401, 'unauthorized', 'Sign in first')
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: auth, error: authError } = await admin.auth.getUser(jwt)
  if (authError || !auth.user) {
    throw new HttpError(401, 'unauthorized', 'Sign in again')
  }
  const { data: member } = await admin.from('library_members').select('user_id')
    .eq('library_id', libraryId).eq('user_id', auth.user.id).maybeSingle()
  if (!member) {
    throw new HttpError(403, 'forbidden', 'Not a member of this library')
  }
  return { admin, userId: auth.user.id }
}

/** Wraps a handler with CORS, JSON parsing and uniform errors. */
export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }
    if (req.method !== 'POST') {
      return json({ code: 'method_not_allowed', message: 'POST only' }, 405)
    }
    try {
      const body = await req.json().catch(() => ({})) as Record<string, unknown>
      return await handler(req, body)
    }
    catch (e) {
      if (e instanceof HttpError) {
        return json({ code: e.code, message: e.message }, e.status)
      }
      console.error(e)
      return json({ code: 'internal', message: e instanceof Error ? e.message : String(e) }, 500)
    }
  })
}

export interface IAiRow {
  provider: 'openai' | 'gemini' | 'openai_compatible'
  model: string
  base_url: string | null
  api_key: string
}

/** The library's decrypted AI config for a purpose, or null when none is configured. */
export async function aiConfig(admin: SupabaseClient, libraryId: string, purpose: 'enrich' | 'vision') {
  const { data, error } = await admin.rpc('ai_config_for', { p_library: libraryId, p_purpose: purpose })
  if (error) {
    throw error
  }
  const row = (data as IAiRow[] | null)?.[0]
  return row ? { provider: row.provider, model: row.model, baseUrl: row.base_url, apiKey: row.api_key } : null
}
