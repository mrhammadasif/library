import type { ILoan } from '~/models/ILoan'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/Http'
import { invalidateLibraryData } from '~/hooks/Invalidate'

/** Books currently lent out, soonest due first. */
export function useOpenLoans(libraryId: string) {
  return useQuery({ queryKey: ['loans', libraryId, 'open'], queryFn: () => api.get<ILoan[]>(`/libraries/${libraryId}/loans`, { query: { open: true } }) })
}

export function useBookLoans(libraryId: string, bookId: string) {
  return useQuery({ queryKey: ['loans', 'book', bookId], queryFn: () => api.get<ILoan[]>(`/libraries/${libraryId}/loans`, { query: { bookId } }) })
}

export function useLendBook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ libraryId, bookId, ...args }: { libraryId: string, bookId: string, borrowerUserId?: string | null, borrowerName?: string, contact?: string, dueAt?: string | null, notes?: string }) =>
      (await api.post<{ id: string }>(`/libraries/${libraryId}/books/${bookId}/lend`, args)).id,
    onSettled: () => invalidateLibraryData(client),
  })
}

export function useReturnBook() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ libraryId, bookId, shelfId }: { libraryId: string, bookId: string, shelfId?: string | null }) =>
      api.post(`/libraries/${libraryId}/books/${bookId}/return`, { shelfId: shelfId ?? null }),
    onSettled: () => invalidateLibraryData(client),
  })
}
