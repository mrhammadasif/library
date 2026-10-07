import type { ColorName } from '~/constants/BookColors'
import type { BookStatus, IBook, IBookEvent, IBookFields } from '~/models/IBook'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/Http'
import { invalidateLibraryData } from '~/hooks/Invalidate'

export interface IBookFilters {
  query?: string
  tags?: string[]
  color?: ColorName | null
  status?: BookStatus | null
  shelfId?: string | null
}

const PAGE = 40

/** Ranked full-text/fuzzy search with filters, paged. Empty filters list the newest books. */
export function useBookSearch(libraryId: string, filters: IBookFilters) {
  return useInfiniteQuery({
    queryKey: ['books', libraryId, 'search', filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get<IBook[]>(`/libraries/${libraryId}/search`, {
      query: {
        q: filters.query?.trim(),
        tags: filters.tags,
        color: filters.color,
        status: filters.status,
        shelfId: filters.shelfId,
        limit: PAGE,
        offset: pageParam,
      },
    }),
    getNextPageParam: (last, pages) => (last.length === PAGE ? pages.length * PAGE : undefined),
  })
}

/** Books whose home is a shelf (on it, lent out or missing), alphabetical. */
export function useShelfBooks(libraryId: string, shelfId: string) {
  return useQuery({
    queryKey: ['books', 'shelf', shelfId],
    queryFn: () => api.get<IBook[]>(`/libraries/${libraryId}/books`, { query: { shelfId } }),
  })
}

export function useRecentBooks(libraryId: string, limit = 10) {
  return useQuery({
    queryKey: ['books', libraryId, 'recent', limit],
    queryFn: () => api.get<IBook[]>(`/libraries/${libraryId}/books`, { query: { order: 'recent', limit } }),
  })
}

/** Books a book check couldn't find: still theirs, waiting to be found, reported borrowed or written off. */
export function useMissingBooks(libraryId: string) {
  return useQuery({
    queryKey: ['books', libraryId, 'missing'],
    queryFn: () => api.get<IBook[]>(`/libraries/${libraryId}/books`, { query: { status: 'missing' } }),
  })
}

export function useArchivedBooks(libraryId: string) {
  return useQuery({
    queryKey: ['books', libraryId, 'archived'],
    queryFn: () => api.get<IBook[]>(`/libraries/${libraryId}/books`, { query: { status: 'archived', order: 'archived' } }),
  })
}

/** Every book that lives on a shelf (not given away), for the visual bookcases. Grouped by shelf id. */
export function useBooksByShelf(libraryId: string) {
  return useQuery({
    queryKey: ['books', libraryId, 'by-shelf'],
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, IBook[]>> => {
      const byShelf = new Map<string, IBook[]>()
      for (const book of await api.get<IBook[]>(`/libraries/${libraryId}/books`)) {
        const list = byShelf.get(book.shelfId!) ?? []
        list.push(book)
        byShelf.set(book.shelfId!, list)
      }
      return byShelf
    },
  })
}

/** Copies of a scanned ISBN already in the library; given-away copies last. */
export async function findCopies(libraryId: string, isbn13: string): Promise<IBook[]> {
  const books = await api.get<IBook[]>(`/libraries/${libraryId}/books`, { query: { isbn: isbn13 } })
  return books.sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived'))
}

export function useBook(libraryId: string, id: string) {
  return useQuery({ queryKey: ['book', id], queryFn: () => api.get<IBook>(`/libraries/${libraryId}/books/${id}`) })
}

export function useBookEvents(libraryId: string, bookId: string) {
  return useQuery({ queryKey: ['events', bookId], queryFn: () => api.get<IBookEvent[]>(`/libraries/${libraryId}/books/${bookId}/events`) })
}

/** Distinct tags with counts, most used first. */
export function useTags(libraryId: string) {
  return useQuery({
    queryKey: ['tags', libraryId],
    staleTime: 60_000,
    queryFn: () => api.get<{ tag: string, books: number }[]>(`/libraries/${libraryId}/tags`),
  })
}

function useLibraryMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => invalidateLibraryData(client) })
}

export function useAddBook() {
  return useLibraryMutation(async ({ libraryId, shelfId, id, fields }: { libraryId: string, shelfId: string, id: string, fields: IBookFields }) =>
    (await api.post<{ id: string }>(`/libraries/${libraryId}/books`, { id, shelfId, book: fields })).id)
}

export function useUpdateBook() {
  return useLibraryMutation(({ libraryId, id, fields }: { libraryId: string, id: string, fields: IBookFields }) =>
    api.put(`/libraries/${libraryId}/books/${id}`, fields))
}

export function useDeleteBook() {
  return useLibraryMutation(({ libraryId, id }: { libraryId: string, id: string }) => api.delete(`/libraries/${libraryId}/books/${id}`))
}

export function useMoveBooks() {
  return useLibraryMutation(async ({ libraryId, bookIds, shelfId }: { libraryId: string, bookIds: string[], shelfId: string }) =>
    (await api.post<{ count: number }>(`/libraries/${libraryId}/books/move`, { bookIds, shelfId })).count)
}

export function useArchiveBooks() {
  return useLibraryMutation(async ({ libraryId, ...args }: { libraryId: string, bookIds: string[], reason: string, recipient?: string, note?: string }) =>
    (await api.post<{ count: number }>(`/libraries/${libraryId}/books/archive`, args)).count)
}

export function useRestoreBook() {
  return useLibraryMutation(({ libraryId, bookId, shelfId }: { libraryId: string, bookId: string, shelfId: string }) =>
    api.post(`/libraries/${libraryId}/books/${bookId}/restore`, { shelfId }))
}

export function useMarkFound() {
  return useLibraryMutation(({ libraryId, bookId, shelfId }: { libraryId: string, bookId: string, shelfId?: string | null }) =>
    api.post(`/libraries/${libraryId}/books/${bookId}/found`, { shelfId: shelfId ?? null }))
}
