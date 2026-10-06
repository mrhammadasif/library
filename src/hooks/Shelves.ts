import type { IRack } from '~/models/IShelf'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabase, unwrap } from '~/api/Supabase'
import { toRack } from '~/mappers/SupabaseMapper'

export const RACKS_KEY = 'racks'

/** Racks in order, each with its shelves in order and how many books call each shelf home. */
export function useRacks(libraryId: string) {
  return useQuery({
    queryKey: [RACKS_KEY, libraryId],
    staleTime: 30_000,
    queryFn: async (): Promise<IRack[]> => {
      const rows = unwrap(await getSupabase().from('racks')
        .select('id, name, notes, position, shelves(id, rack_id, name, notes, position, books(count))')
        .eq('library_id', libraryId)
        .order('position'))
      return (rows as unknown as Parameters<typeof toRack>[0][]).map(toRack)
    },
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
    const db = getSupabase().from('racks')
    if (id) {
      unwrap(await db.update({ name: name.trim(), notes: notes ?? null }).eq('id', id))
      return id
    }
    const row = unwrap(await db.insert({ library_id: libraryId, name: name.trim(), notes: notes ?? null }).select('id').single())
    return (row as unknown as { id: string }).id
  })
}

export function useDeleteRack() {
  return useRackMutation(async (id: string) => {
    unwrap(await getSupabase().from('racks').delete().eq('id', id))
  })
}

export function useSaveShelf() {
  return useRackMutation(async ({ libraryId, rackId, id, name }: { libraryId: string, rackId: string, id?: string, name: string }) => {
    const db = getSupabase().from('shelves')
    unwrap(id
      ? await db.update({ name: name.trim(), rack_id: rackId }).eq('id', id)
      : await db.insert({ library_id: libraryId, rack_id: rackId, name: name.trim() }))
  })
}

export function useDeleteShelf() {
  return useRackMutation(async (id: string) => {
    unwrap(await getSupabase().from('shelves').delete().eq('id', id))
  })
}

/** Optimistic reorder so the list doesn't jump back while the RPC runs. */
export function useReorderRacks(libraryId: string) {
  const client = useQueryClient()
  const key = [RACKS_KEY, libraryId]
  return useMutation({
    mutationFn: async (ids: string[]) => {
      unwrap(await getSupabase().rpc('reorder_racks', { p_library: libraryId, p_ids: ids }))
    },
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
    mutationFn: async ({ rackId, ids }: { rackId: string, ids: string[] }) => {
      unwrap(await getSupabase().rpc('reorder_shelves', { p_rack: rackId, p_ids: ids }))
    },
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
