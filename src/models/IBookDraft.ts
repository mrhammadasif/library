// The lookup/enrichment shapes returned by the edge functions (supabase/functions/_shared).
export type { IBookDraft } from '~fn/metadata'

export interface IEnrichment {
  categories: string[]
  tags: string[]
  description: string | null
  language: string | null
}

export interface IIdentification {
  title: string
  subtitle: string | null
  authors: string[]
  isbn: string | null
  publisher: string | null
  confidence: number
}
