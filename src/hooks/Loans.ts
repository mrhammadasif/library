import type { ILoan } from '~/models/ILoan'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, unwrap } from '~/api/Supabase'
import { invalidateLibraryData } from '~/hooks/Invalidate'
import { toLoan } from '~/mappers/SupabaseMapper'

const LOAN_COLUMNS = 'id, book_id, borrower_user_id, borrower_name, borrower_contact, notes, lent_at, due_at, returned_at, book:books(title)'

/** Books currently lent out, soonest due first. */
export function useOpenLoans(libraryId: string) {
  return useQuery({
    queryKey: ['loans', libraryId, 'open'],
    queryFn: async (): Promise<ILoan[]> => {
      const rows = unwrap(await getSupabase().from('loans').select(LOAN_COLUMNS)
        .eq('library_id', libraryId).is('returned_at', null).order('due_at', { ascending: true, nullsFirst: false }))
      return (rows as unknown as Parameters<typeof toLoan>[0][]).map(toLoan)
    },
  })
}

export function useBookLoans(bookId: string) {
  return useQuery({
    queryKey: ['loans', 'book', bookId],
    queryFn: async (): Promise<ILoan[]> => {
      const rows = unwrap(await getSupabase().from('loans').select(LOAN_COLUMNS)
        .eq('book_id', bookId).order('lent_at', { ascending: false }).limit(20))
      return (rows as unknown as Parameters<typeof toLoan>[0][]).map(toLoan)
    },
  })
}

export function useLendBook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (args: { bookId: string, borrowerUserId?: string | null, borrowerName?: string, contact?: string, dueAt?: string | null, notes?: string }) =>
      unwrap(await getSupabase().rpc('lend_book', {
        p_book: args.bookId,
        p_borrower_user: args.borrowerUserId ?? null,
        p_borrower_name: args.borrowerName ?? null,
        p_borrower_contact: args.contact ?? null,
        p_due_at: args.dueAt ?? null,
        p_notes: args.notes ?? null,
      })) as string,
    onSettled: () => invalidateLibraryData(client),
  })
}

export function useReturnBook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ bookId, shelfId }: { bookId: string, shelfId?: string | null }) => {
      unwrap(await getSupabase().rpc('return_book', { p_book: bookId, p_shelf: shelfId ?? null }))
    },
    onSettled: () => invalidateLibraryData(client),
  })
}
