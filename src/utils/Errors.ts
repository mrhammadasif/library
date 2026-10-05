import { permissionLabel } from '~/constants/Permissions'

interface IPostgrestLikeError {
  code?: string
  message?: string
  hint?: string | null
}

/** Human-readable message for Supabase/PostgREST/edge-function errors. */
export function errorMessage(error: unknown): string {
  if (!error) {
    return 'Something went wrong'
  }
  const e = error as IPostgrestLikeError
  if (e.code === '42501' && e.hint) {
    return `You need the "${permissionLabel(e.hint)}" permission for this.`
  }
  if (e.code === '42501') {
    return 'You don\'t have permission to do this.'
  }
  if (e.code === '23503') {
    return 'This is still in use (for example a shelf that still has books). Move things off it first.'
  }
  if (e.code === 'PGRST301' || e.code === 'PGRST303') {
    return 'Your session expired. Sign in again.'
  }
  return e.message || String(error)
}
