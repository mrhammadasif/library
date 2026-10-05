import type { IBookDraft } from '~/models/IBookDraft'

// Hands a chosen candidate (e.g. from cover recognition) to the review screen without squeezing it into route
// params. One slot is enough: only one add flow runs at a time.
let pending: { draft: IBookDraft, photoUri: string | null } | null = null

export function setPendingDraft(draft: IBookDraft, photoUri: string | null = null): void {
  pending = { draft, photoUri }
}

export function takePendingDraft(): { draft: IBookDraft, photoUri: string | null } | null {
  const value = pending
  pending = null
  return value
}
