import type { Permission } from '~shared/permissions'

/** An API error with the server's stable code (e.g. 'not_on_shelf', 'forbidden' + permission). */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public permission?: Permission) {
    super(message)
  }
}

export type Query = Record<string, string | number | boolean | string[] | null | undefined>

/** ?a=1&tags=x,y, skipping empty values. */
export function buildQuery(query: Query = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || (Array.isArray(value) && !value.length) || value === '') {
      continue
    }
    params.set(key, Array.isArray(value) ? value.join(',') : String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** Turns a non-2xx response body into an ApiError (the API's shape is { statusCode, code, message, permission? }). */
export function toApiError(status: number, body: unknown): ApiError {
  const b = (body && typeof body === 'object' ? body : {}) as { code?: string, message?: string, permission?: Permission }
  return new ApiError(status, b.code ?? `http_${status}`, b.message ?? 'Something went wrong', b.permission)
}
