import type { IMe, IMembership } from '~/models/ILibrary'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/Http'

export const MEMBERSHIPS_KEY = ['memberships'] as const
export const ME_KEY = ['me'] as const

/** Every library the signed-in user belongs to, with their role and permissions. */
export function useMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: [...MEMBERSHIPS_KEY, userId],
    enabled: !!userId,
    queryFn: () => api.get<IMembership[]>('/libraries'),
  })
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: ME_KEY, enabled, queryFn: () => api.get<IMe>('/me') })
}

function useMembershipMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }) })
}

export function useCreateLibrary() {
  return useMembershipMutation(async (name: string) => (await api.post<{ id: string }>('/libraries', { name })).id)
}

export function useAcceptInvite() {
  return useMembershipMutation(async (code: string) => (await api.post<{ libraryId: string }>('/invites/accept', { code })).libraryId)
}

export function useRenameLibrary() {
  return useMembershipMutation(({ libraryId, name }: { libraryId: string, name: string }) => api.patch(`/libraries/${libraryId}`, { name }))
}

export function useDeleteLibrary() {
  return useMembershipMutation((libraryId: string) => api.delete(`/libraries/${libraryId}`))
}

/** Server admin only. */
export function useSetHomeAi() {
  return useMembershipMutation(({ libraryId, allowed }: { libraryId: string, allowed: boolean }) => api.put(`/libraries/${libraryId}/home-ai`, { allowed }))
}
