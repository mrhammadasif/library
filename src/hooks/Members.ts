import type { Permission } from '~/constants/Permissions'
import type { IInvite, IMember } from '~/models/ILibrary'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient } from '~/api/Auth'
import { api } from '~/api/Http'
import { ME_KEY, MEMBERSHIPS_KEY } from '~/hooks/Libraries'

const MEMBERS_KEY = 'members'
const INVITES_KEY = 'invites'

export function useMembers(libraryId: string) {
  return useQuery({ queryKey: [MEMBERS_KEY, libraryId], queryFn: () => api.get<IMember[]>(`/libraries/${libraryId}/members`) })
}

/** Active invites (needs members.manage). */
export function useInvites(libraryId: string, enabled: boolean) {
  return useQuery({ queryKey: [INVITES_KEY, libraryId], enabled, queryFn: () => api.get<IInvite[]>(`/libraries/${libraryId}/invites`) })
}

function useMemberMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: [MEMBERS_KEY] }),
      client.invalidateQueries({ queryKey: [INVITES_KEY] }),
      client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
      client.invalidateQueries({ queryKey: ME_KEY }),
    ]),
  })
}

export function useCreateInvite() {
  return useMemberMutation(async ({ libraryId, ...input }: { libraryId: string, permissions: Permission[], days: number, maxUses: number }) =>
    (await api.post<{ code: string }>(`/libraries/${libraryId}/invites`, input)).code)
}

export function useDeleteInvite(libraryId: string) {
  return useMemberMutation((id: string) => api.delete(`/libraries/${libraryId}/invites/${id}`))
}

export function useSetMemberPermissions() {
  return useMemberMutation(({ libraryId, userId, permissions }: { libraryId: string, userId: string, permissions: Permission[] }) =>
    api.put(`/libraries/${libraryId}/members/${userId}/permissions`, { permissions }))
}

/** Leave (your own id) or remove someone. */
export function useRemoveMember() {
  return useMemberMutation(({ libraryId, userId }: { libraryId: string, userId: string }) => api.delete(`/libraries/${libraryId}/members/${userId}`))
}

export function useSetOwner() {
  return useMemberMutation(({ libraryId, userId, owner }: { libraryId: string, userId: string, owner: boolean }) =>
    api.put(`/libraries/${libraryId}/members/${userId}/owner`, { owner }))
}

export function useUpdateDisplayName() {
  return useMemberMutation(async ({ name }: { name: string }) => {
    const { error } = await authClient.updateUser({ name: name.trim() })
    if (error) {
      throw new Error(error.message)
    }
  })
}
