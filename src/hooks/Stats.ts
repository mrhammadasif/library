import type { ILibraryStats } from '~/models/IStats'
import { useQuery } from '@tanstack/react-query'
import { getSupabase, unwrap } from '~/api/Supabase'

export function useLibraryStats(libraryId: string) {
  return useQuery({
    queryKey: ['stats', libraryId],
    staleTime: 30_000,
    queryFn: async () => unwrap(await getSupabase().rpc('library_stats', { p_library: libraryId })) as ILibraryStats,
  })
}
