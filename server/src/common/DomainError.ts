/** A business-rule failure with a stable code the app can show (e.g. 'not_on_shelf'). */
export class DomainError extends Error {
  constructor(public status: 400 | 403 | 404 | 409 | 429, public code: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message)
  }
}

export const notFound = (what: string) => new DomainError(404, 'not_found', `${what} not found`)
