import type { IRack } from '~/models/IShelf'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/Http'

export const RACKS_KEY = 'racks'

/** Bookcases in order, each with its shelves in order and how many books call each shelf home. */
export function useRacks(libraryId: string) {
  return useQuery({
    queryKey: [RACKS_KEY, libraryId],
    staleTime: 30_000,
    queryFn: () => api.get<IRack[]>(`/libraries/${libraryId}/racks`),
  })
}

/** shelfId → "Bookcase · Shelf" label, for book rows and pickers. */
export function shelfLabels(racks: IRack[] | undefined): Map<string, string> {
  const labels = new Map<string, string>()
  for (const rack of racks ?? []) {
    for (const shelf of rack.shelves) {
      labels.set(shelf.id, `${rack.name} · ${shelf.name}`)
    }
  }
  return labels
}

function useRackMutation<TArgs, TResult = void>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => client.invalidateQueries({ queryKey: [RACKS_KEY] }),
  })
}

/** Creates or renames a bookcase; resolves to its id. */
export function useSaveRack() {
  return useRackMutation(async ({ libraryId, id, name, notes }: { libraryId: string, id?: string, name: string, notes?: string | null }) => {
    if (id) {
      await api.patch(`/libraries/${libraryId}/racks/${id}`, { name, notes: notes ?? null })
      return id
    }
    return (await api.post<{ id: string }>(`/libraries/${libraryId}/racks`, { name, notes: notes ?? null })).id
  })
}

export function useDeleteRack(libraryId: string) {
  return useRackMutation((id: string) => api.delete(`/libraries/${libraryId}/racks/${id}`))
}

export function useSaveShelf() {
  return useRackMutation(async ({ libraryId, rackId, id, name }: { libraryId: string, rackId: string, id?: string, name: string }) => {
    if (id) {
      await api.patch(`/libraries/${libraryId}/shelves/${id}`, { name, rackId })
    }
    else {
      await api.post(`/libraries/${libraryId}/racks/${rackId}/shelves`, { name })
    }
  })
}

export function useDeleteShelf(libraryId: string) {
  return useRackMutation((id: string) => api.delete(`/libraries/${libraryId}/shelves/${id}`))
}

/** Optimistic reorder so the list doesn't jump back while the request runs. */
export function useReorderRacks(libraryId: string) {
  const client = useQueryClient()
  const key = [RACKS_KEY, libraryId]
  return useMutation({
    mutationFn: (ids: string[]) => api.put(`/libraries/${libraryId}/racks/order`, { ids }),
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<IRack[]>(key)
      if (previous) {
        client.setQueryData<IRack[]>(key, ids.map(id => previous.find(r => r.id === id)!).filter(Boolean))
      }
      return { previous }
    },
    onError: (_e, _ids, context) => client.setQueryData(key, context?.previous),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  })
}

export function useReorderShelves(libraryId: string) {
  const client = useQueryClient()
  const key = [RACKS_KEY, libraryId]
  return useMutation({
    mutationFn: ({ rackId, ids }: { rackId: string, ids: string[] }) => api.put(`/libraries/${libraryId}/racks/${rackId}/shelves/order`, { ids }),
    onMutate: async ({ rackId, ids }) => {
      await client.cancelQueries({ queryKey: key })
      const previous = client.getQueryData<IRack[]>(key)
      if (previous) {
        client.setQueryData<IRack[]>(key, previous.map(rack => rack.id !== rackId
          ? rack
          : { ...rack, shelves: ids.map(id => rack.shelves.find(s => s.id === id)!).filter(Boolean) }))
      }
      return { previous }
    },
    onError: (_e, _args, context) => client.setQueryData(key, context?.previous),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  })
}
