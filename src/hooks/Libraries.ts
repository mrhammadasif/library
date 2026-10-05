import type { IMembership } from '~/models/ILibrary'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, unwrap } from '~/api/Supabase'
import { toMembership } from '~/mappers/SupabaseMapper'

export const MEMBERSHIPS_KEY = ['memberships'] as const

/** Every library the signed-in user belongs to, with their role and permissions. */
export function useMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: [...MEMBERSHIPS_KEY, userId],
    enabled: !!userId,
    queryFn: async (): Promise<IMembership[]> => {
      const rows = unwrap(await getSupabase().from('library_members')
        .select('role, permissions, library:libraries(id, name, enrich_provider, vision_provider)')
        .eq('user_id', userId!))
      return (rows as unknown as Parameters<typeof toMembership>[0][])
        .map(toMembership)
        .filter((m): m is IMembership => m !== null)
        .sort((a, b) => a.library.name.localeCompare(b.library.name))
    },
  })
}

export function useCreateLibrary() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => unwrap(await getSupabase().rpc('create_library', { p_name: name })) as string,
    onSettled: () => client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
  })
}

export function useAcceptInvite() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (code: string) => unwrap(await getSupabase().rpc('accept_invite', { p_code: code })) as string,
    onSettled: () => client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
  })
}

export function useRenameLibrary() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ libraryId, name }: { libraryId: string, name: string }) => {
      unwrap(await getSupabase().from('libraries').update({ name: name.trim() }).eq('id', libraryId))
    },
    onSettled: () => client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
  })
}

export function useDeleteLibrary() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (libraryId: string) => {
      unwrap(await getSupabase().from('libraries').delete().eq('id', libraryId))
    },
    onSettled: () => client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
  })
}
