import type { AiProvider, IAiProviderConfig } from '~/models/ILibrary'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/Http'
import { MEMBERSHIPS_KEY } from '~/hooks/Libraries'

const AI_KEY = 'ai-providers'

export function useAiProviders(libraryId: string) {
  return useQuery({ queryKey: [AI_KEY, libraryId], queryFn: () => api.get<IAiProviderConfig[]>(`/libraries/${libraryId}/ai/providers`) })
}

function useAiMutation<TArgs>(fn: (args: TArgs) => Promise<void>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: [AI_KEY] }),
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
