import type { AiProvider, IAiProviderConfig } from '~/models/ILibrary'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, unwrap } from '~/api/Supabase'
import { MEMBERSHIPS_KEY } from '~/hooks/Libraries'
import { toAiProvider } from '~/mappers/SupabaseMapper'

const AI_KEY = 'ai-providers'

export function useAiProviders(libraryId: string) {
  return useQuery({
    queryKey: [AI_KEY, libraryId],
    queryFn: async (): Promise<IAiProviderConfig[]> => {
      const rows = unwrap(await getSupabase().rpc('list_ai_providers', { p_library: libraryId }))
      return (rows as Parameters<typeof toAiProvider>[0][]).map(toAiProvider)
    },
  })
}

function useAiMutation<TArgs>(fn: (args: TArgs) => Promise<void>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: [AI_KEY] }),
      // enrich/vision provider choices live on the library row.
      client.invalidateQueries({ queryKey: MEMBERSHIPS_KEY }),
    ]),
  })
}

export function useSetAiProvider() {
  return useAiMutation(async (args: { libraryId: string, provider: AiProvider, model: string, baseUrl?: string | null, apiKey?: string | null, supportsVision?: boolean }) => {
    unwrap(await getSupabase().rpc('set_ai_provider', {
      p_library: args.libraryId,
      p_provider: args.provider,
      p_model: args.model,
      p_base_url: args.baseUrl ?? null,
      p_api_key: args.apiKey ?? null,
      p_supports_vision: args.supportsVision ?? false,
    }))
  })
}

export function useDeleteAiProvider() {
  return useAiMutation(async ({ libraryId, provider }: { libraryId: string, provider: AiProvider }) => {
    unwrap(await getSupabase().rpc('delete_ai_provider', { p_library: libraryId, p_provider: provider }))
  })
}

export function useSetAiUsage() {
  return useAiMutation(async ({ libraryId, enrich, vision }: { libraryId: string, enrich: AiProvider | null, vision: AiProvider | null }) => {
    unwrap(await getSupabase().rpc('set_ai_usage', { p_library: libraryId, p_enrich: enrich, p_vision: vision }))
  })
}
