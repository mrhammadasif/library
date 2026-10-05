import type { ColorName } from '~/constants/BookColors'
import type { BookStatus, IBook, IBookEvent, IBookFields } from '~/models/IBook'
import type { IBookRow } from '~/mappers/SupabaseMapper'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, unwrap } from '~/api/Supabase'
import { invalidateLibraryData } from '~/hooks/Invalidate'
import { BOOK_COLUMNS, toBook, toBookPayload, toEvent } from '~/mappers/SupabaseMapper'

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
    queryFn: async ({ pageParam }): Promise<IBook[]> => {
      const rows = unwrap(await getSupabase().rpc('search_books', {
        p_library: libraryId,
        p_query: filters.query?.trim() || null,
        p_tags: filters.tags?.length ? filters.tags : null,
        p_color: filters.color ?? null,
        p_status: filters.status ?? null,
        p_shelf: filters.shelfId ?? null,
        p_limit: PAGE,
        p_offset: pageParam,
      }))
      return (rows as IBookRow[]).map(toBook)
    },
    getNextPageParam: (last, pages) => (last.length === PAGE ? pages.length * PAGE : undefined),
  })
}

/** Books whose home is a shelf (on it, lent out or missing), alphabetical. */
export function useShelfBooks(shelfId: string) {
  return useQuery({
    queryKey: ['books', 'shelf', shelfId],
    queryFn: async (): Promise<IBook[]> => {
      const rows = unwrap(await getSupabase().from('books').select(BOOK_COLUMNS).eq('shelf_id', shelfId).order('title'))
      return (rows as unknown as IBookRow[]).map(toBook)
    },
  })
}

export function useRecentBooks(libraryId: string, limit = 10) {
  return useQuery({
    queryKey: ['books', libraryId, 'recent', limit],
    queryFn: async (): Promise<IBook[]> => {
      const rows = unwrap(await getSupabase().from('books').select(BOOK_COLUMNS)
        .eq('library_id', libraryId).neq('status', 'archived').order('created_at', { ascending: false }).limit(limit))
      return (rows as unknown as IBookRow[]).map(toBook)
    },
  })
}

export function useArchivedBooks(libraryId: string) {
  return useQuery({
    queryKey: ['books', libraryId, 'archived'],
    queryFn: async (): Promise<IBook[]> => {
      const rows = unwrap(await getSupabase().from('books').select(BOOK_COLUMNS)
        .eq('library_id', libraryId).eq('status', 'archived').order('archived_at', { ascending: false }))
      return (rows as unknown as IBookRow[]).map(toBook)
    },
  })
}

export function useBook(id: string) {
  return useQuery({
    queryKey: ['book', id],
    queryFn: async (): Promise<IBook | null> => {
      const row = unwrap(await getSupabase().from('books').select(BOOK_COLUMNS).eq('id', id).maybeSingle())
      return row ? toBook(row as unknown as IBookRow) : null
    },
  })
}

export function useBookEvents(bookId: string) {
  return useQuery({
    queryKey: ['events', bookId],
    queryFn: async (): Promise<IBookEvent[]> => {
      const rows = unwrap(await getSupabase().from('book_events')
        .select('id, type, from_shelf_id, to_shelf_id, payload, at, actor')
        .eq('book_id', bookId).order('at', { ascending: false }).limit(50))
      const events = rows as unknown as (Omit<Parameters<typeof toEvent>[0], 'actor_profile'> & { actor: string | null })[]
      // book_events.actor references auth.users (not profiles), so names are joined client-side.
      const actorIds = [...new Set(events.map(e => e.actor).filter((a): a is string => !!a))]
      const profiles = actorIds.length
        ? unwrap(await getSupabase().from('profiles').select('id, display_name').in('id', actorIds)) as { id: string, display_name: string }[]
        : []
      return events.map(e => toEvent({ ...e, actor_profile: profiles.find(p => p.id === e.actor) ?? null }))
    },
  })
}

/** Distinct tags with counts, most used first. */
export function useTags(libraryId: string) {
  return useQuery({
    queryKey: ['tags', libraryId],
    staleTime: 60_000,
    queryFn: async () => unwrap(await getSupabase().rpc('list_tags', { p_library: libraryId })) as { tag: string, books: number }[],
  })
}

function useLibraryMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => invalidateLibraryData(client) })
}

export function useAddBook() {
  return useLibraryMutation(async ({ libraryId, shelfId, id, fields }: { libraryId: string, shelfId: string, id: string, fields: IBookFields }) =>
    unwrap(await getSupabase().rpc('add_book', { p_library: libraryId, p_shelf: shelfId, p_book: { id, ...toBookPayload(fields) } })) as string)
}

export function useUpdateBook() {
  return useLibraryMutation(async ({ id, fields }: { id: string, fields: IBookFields }) => {
    unwrap(await getSupabase().from('books').update(toBookPayload(fields)).eq('id', id))
  })
}

export function useDeleteBook() {
  return useLibraryMutation(async (id: string) => {
    unwrap(await getSupabase().from('books').delete().eq('id', id))
  })
}

export function useMoveBooks() {
  return useLibraryMutation(async ({ bookIds, shelfId }: { bookIds: string[], shelfId: string }) =>
    unwrap(await getSupabase().rpc('move_books', { p_book_ids: bookIds, p_shelf: shelfId })) as number)
}

export function useArchiveBooks() {
  return useLibraryMutation(async (args: { bookIds: string[], reason: string, recipient?: string, note?: string }) =>
    unwrap(await getSupabase().rpc('archive_books', {
      p_book_ids: args.bookIds,
      p_reason: args.reason,
      p_recipient: args.recipient ?? null,
      p_note: args.note ?? null,
    })) as number)
}

export function useRestoreBook() {
  return useLibraryMutation(async ({ bookId, shelfId }: { bookId: string, shelfId: string }) => {
    unwrap(await getSupabase().rpc('restore_book', { p_book: bookId, p_shelf: shelfId }))
  })
}

export function useMarkFound() {
  return useLibraryMutation(async ({ bookId, shelfId }: { bookId: string, shelfId?: string | null }) => {
    unwrap(await getSupabase().rpc('mark_book_found', { p_book: bookId, p_shelf: shelfId ?? null }))
  })
}
