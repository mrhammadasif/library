import type { ILibraryStats } from '~/models/IStats'
import { useQuery } from '@tanstack/react-query'
import { api } from '~/api/Http'

export function useLibraryStats(libraryId: string) {
  return useQuery({ queryKey: ['stats', libraryId], staleTime: 30_000, queryFn: () => api.get<ILibraryStats>(`/libraries/${libraryId}/stats`) })
}
