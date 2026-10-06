import type { z } from 'zod'
import type { Query } from '~/api/ApiError'
import { buildQuery, toApiError } from '~/api/ApiError'
import { authClient } from '~/api/Auth'
import { API_URL, COVERS_URL } from '~/api/Env'

interface IRequest<T> {
  body?: unknown
  query?: Query
  /** Validates the response, so a server/app mismatch fails loudly instead of rendering nonsense. */
  schema?: z.ZodType<T>
}

export async function request<T = void>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, { body, query, schema }: IRequest<T> = {}): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}${buildQuery(query)}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': await authClient.getCookie(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'omit',
  })
  const text = await response.text()
  const json = text ? JSON.parse(text) : undefined
  if (!response.ok) {
    throw toApiError(response.status, json)
  }
  return schema ? schema.parse(json) : json as T
}

export const api = {
  get: <T>(path: string, opts?: IRequest<T>) => request<T>('GET', path, opts),
  post: <T = void>(path: string, body?: unknown, opts?: IRequest<T>) => request<T>('POST', path, { ...opts, body: body ?? {} }),
  put: <T = void>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),
  patch: <T = void>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}

/** Public URL of an uploaded cover (Garage), or the external cover URL from the book APIs. */
export function coverUri(coverPath: string | null, coverUrl: string | null): string | null {
  return coverPath ? `${COVERS_URL}/${coverPath}` : coverUrl
}
