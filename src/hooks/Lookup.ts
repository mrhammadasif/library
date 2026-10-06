import type { IBookDraft, IEnrichment, IIdentification } from '~/models/IBookDraft'
import type { ILookupResultDto } from '~shared/contracts/Lookup'
import { api } from '~/api/Http'

export type ILookupResult = ILookupResultDto

export function lookupIsbn(libraryId: string, isbn: string): Promise<ILookupResult> {
  return api.post<ILookupResult>(`/libraries/${libraryId}/lookup`, { isbn })
}

export function lookupText(libraryId: string, title: string, author?: string): Promise<ILookupResult> {
  return api.post<ILookupResult>(`/libraries/${libraryId}/lookup`, { title, author })
}

export function enrichDraft(libraryId: string, draft: IBookDraft): Promise<{ enrichment: IEnrichment, provider: string }> {
  return api.post(`/libraries/${libraryId}/ai/enrich`, { draft })
}

export function identifyCover(libraryId: string, imageBase64: string): Promise<{ identification: IIdentification, candidates: IBookDraft[] }> {
  return api.post(`/libraries/${libraryId}/ai/identify-cover`, { imageBase64 })
}
