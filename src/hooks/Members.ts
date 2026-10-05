import type { Permission } from '~/constants/Permissions'
import type { IInvite, IMember } from '~/models/ILibrary'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, unwrap } from '~/api/Supabase'
import { MEMBERSHIPS_KEY } from '~/hooks/Libraries'
import { toInvite, toMember } from '~/mappers/SupabaseMapper'

const MEMBERS_KEY = 'members'
const INVITES_KEY = 'invites'

export function useMembers(libraryId: string) {
  return useQuery({
    queryKey: [MEMBERS_KEY, libraryId],
    queryFn: async (): Promise<IMember[]> => {
      const rows = unwrap(await getSupabase().from('library_members')
        .select('user_id, role, permissions, created_at, profile:profiles(display_name)')
        .eq('library_id', libraryId))
      return (rows as unknown as Parameters<typeof toMember>[0][]).map(toMember)
        .sort((a, b) => (a.role === b.role ? a.displayName.localeCompare(b.displayName) : a.role === 'owner' ? -1 : 1))
    },
  })
}

/** Active invites (needs members.manage; RLS returns none otherwise). */
export function useInvites(libraryId: string, enabled: boolean) {
  return useQuery({
    queryKey: [INVITES_KEY, libraryId],
    enabled,
    queryFn: async (): Promise<IInvite[]> => {
      const rows = unwrap(await getSupabase().from('library_invites')
        .select('id, code, permissions, expires_at, max_uses, uses')
        .eq('library_id', libraryId).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }))
      return (rows as unknown as Parameters<typeof toInvite>[0][]).map(toInvite).filter(i => i.uses < i.maxUses)
    },
  })
}

function useMemberMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: [MEMBERS_KEY] }),
      client.invalidateQueries({ queryKey: [INVITES_KEY] }),
      client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
    ]),
  })
}

export function useCreateInvite() {
  return useMemberMutation(async ({ libraryId, permissions, days, maxUses }: { libraryId: string, permissions: Permission[], days: number, maxUses: number }) =>
    unwrap(await getSupabase().rpc('create_invite', {
      p_library: libraryId,
      p_permissions: permissions,
      p_days: days,
      p_max_uses: maxUses,
    })) as string)
}

export function useDeleteInvite() {
  return useMemberMutation(async (id: string) => {
    unwrap(await getSupabase().from('library_invites').delete().eq('id', id))
  })
}

export function useSetMemberPermissions() {
  return useMemberMutation(async ({ libraryId, userId, permissions }: { libraryId: string, userId: string, permissions: Permission[] }) => {
    unwrap(await getSupabase().rpc('set_member_permissions', { p_library: libraryId, p_user: userId, p_permissions: permissions }))
  })
}

export function useRemoveMember() {
  return useMemberMutation(async ({ libraryId, userId }: { libraryId: string, userId: string }) => {
    unwrap(await getSupabase().rpc('remove_member', { p_library: libraryId, p_user: userId }))
  })
}

export function useSetOwner() {
  return useMemberMutation(async ({ libraryId, userId, owner }: { libraryId: string, userId: string, owner: boolean }) => {
    unwrap(await getSupabase().rpc('set_owner', { p_library: libraryId, p_user: userId, p_owner: owner }))
  })
}

export function useUpdateDisplayName() {
  return useMemberMutation(async ({ userId, name }: { userId: string, name: string }) => {
    unwrap(await getSupabase().from('profiles').update({ display_name: name.trim() }).eq('id', userId))
  })
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: [MEMBERS_KEY, 'profile', userId],
    enabled: !!userId,
    queryFn: async () => unwrap(await getSupabase().from('profiles').select('display_name').eq('id', userId!).single()) as { display_name: string },
  })
}
