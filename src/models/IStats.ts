import type { ColorName } from '~/constants/BookColors'
import type { BookStatus } from '~/models/IBook'

interface INamedCount {
  name: string
  books: number
}

/** Shape of the library_stats() RPC result. */
export interface ILibraryStats {
  total: number
  archived: number
  by_status: Partial<Record<BookStatus, number>>
  pages: number
  authors: number
  racks: { id: string, name: string, books: number, shelves: { id: string, name: string, books: number }[] }[]
  top_authors: INamedCount[]
  top_categories: INamedCount[]
  top_tags: INamedCount[]
  colors: { color: ColorName, books: number }[]
  languages: INamedCount[]
  decades: { decade: number, books: number }[]
  added_by_month: { month: string, books: number }[]
  loans: { open: number, overdue: number, total: number }
  audit: {
    last: { id: string, completed_at: string, mode: string, found: number, missing: number, total: number } | null
    unseen_year: number
  }
}
