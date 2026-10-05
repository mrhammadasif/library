import type { IBookDraft, IEnrichment, IIdentification } from '~/models/IBookDraft'
import { invokeFunction } from '~/api/Supabase'

export interface ILookupResult {
  draft: IBookDraft | null
  candidates: IBookDraft[]
  sources: { openLibrary?: boolean, googleBooks?: boolean }
  isbn: { isbn13: string, isbn10: string | null } | null
  existingCopies: { id: string, title: string, status: string, shelf_id: string | null }[]
}

export function lookupIsbn(libraryId: string, isbn: string): Promise<ILookupResult> {
  return invokeFunction<ILookupResult>('lookup-book', { libraryId, isbn })
}

export function lookupText(libraryId: string, title: string, author?: string): Promise<ILookupResult> {
  return invokeFunction<ILookupResult>('lookup-book', { libraryId, title, author })
}

export function enrichDraft(libraryId: string, draft: IBookDraft): Promise<{ enrichment: IEnrichment, provider: string }> {
  return invokeFunction('enrich-book', { libraryId, draft })
}

export function identifyCover(libraryId: string, imageBase64: string): Promise<{ identification: IIdentification, candidates: IBookDraft[] }> {
  return invokeFunction('identify-cover', { libraryId, imageBase64 })
}
