import type { AiProvider, IAiProviderConfig } from '~/models/ILibrary'
import type { IAiLimitDto } from '~shared/contracts/Ai'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/Http'
import { MEMBERSHIPS_KEY } from '~/hooks/Libraries'

const AI_KEY = 'ai-providers'
const LIMIT_KEY = 'ai-limit'

export function useAiProviders(libraryId: string) {
  return useQuery({ queryKey: [AI_KEY, libraryId], queryFn: () => api.get<IAiProviderConfig[]>(`/libraries/${libraryId}/ai/providers`) })
}

function useAiMutation<TArgs>(fn: (args: TArgs) => Promise<void>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: [AI_KEY] }),
      client.invalidateQueries({ queryKey: [LIMIT_KEY] }),
      // enrich/vision choices live on the library.
      client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
    ]),
  })
}

export function useSetAiProvider() {
  return useAiMutation(({ libraryId, provider, ...input }: { libraryId: string, provider: AiProvider, model: string, baseUrl?: string | null, apiKey?: string | null, supportsVision?: boolean }) =>
    api.put(`/libraries/${libraryId}/ai/providers/${provider}`, { ...input, supportsVision: input.supportsVision ?? false }))
}

export function useDeleteAiProvider() {
  return useAiMutation(({ libraryId, provider }: { libraryId: string, provider: AiProvider }) => api.delete(`/libraries/${libraryId}/ai/providers/${provider}`))
}

export function useSetAiUsage() {
  return useAiMutation(({ libraryId, enrich, vision }: { libraryId: string, enrich: AiProvider | null, vision: AiProvider | null }) =>
    api.put(`/libraries/${libraryId}/ai/usage`, { enrich, vision }))
}

/** The library's own daily cap on AI requests and today's use (managers only). */
export function useAiLimit(libraryId: string, enabled = true) {
  return useQuery({ queryKey: [LIMIT_KEY, libraryId], enabled, queryFn: () => api.get<IAiLimitDto>(`/libraries/${libraryId}/ai/limit`) })
}

export function useSetAiLimit() {
  return useAiMutation(({ libraryId, dailyLimit }: { libraryId: string, dailyLimit: number | null }) =>
    api.put(`/libraries/${libraryId}/ai/limit`, { dailyLimit }))
}
