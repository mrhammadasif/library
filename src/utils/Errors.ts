import { permissionLabel } from '~/constants/Permissions'

interface IErrorLike {
  code?: string
  message?: string
  permission?: string
  status?: number
}

/** Human-readable message for API, auth and network errors. */
export function errorMessage(error: unknown): string {
  if (!error) {
    return 'Something went wrong'
  }
  const e = error as IErrorLike
  if (e.code === 'forbidden' && e.permission) {
    return `You need the "${permissionLabel(e.permission)}" permission for this.`
  }
  if (e.code === 'email_unverified') {
    return 'Verify your email first: check your inbox for a code.'
  }
  if (e.code === 'unauthorized' || e.status === 401) {
    return 'Your session ended. Sign in again.'
  }
  if (e.code === 'invalid_input') {
    return 'Some details are missing or wrong.'
  }
  if (error instanceof TypeError && /network|fetch/i.test(error.message)) {
    return 'Can\'t reach the library server. Check your internet connection.'
  }
  return e.message || String(error)
}
