import type { AuditMode, AuditResult, IAudit, IAuditItem } from '~/models/IAudit'
import type { IAuditItemDto } from '~shared/contracts/Audits'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, coverUri } from '~/api/Http'
import { invalidateLibraryData } from '~/hooks/Invalidate'

export function useAudits(libraryId: string) {
  return useQuery({ queryKey: ['audits', libraryId], queryFn: () => api.get<IAudit[]>(`/libraries/${libraryId}/audits`) })
}

export function useAudit(libraryId: string, auditId: string) {
  return useQuery({
    queryKey: ['audit', auditId],
    queryFn: async (): Promise<{ audit: IAudit, items: IAuditItem[] }> => {
      const detail = await api.get<{ audit: IAudit, items: IAuditItemDto[] }>(`/libraries/${libraryId}/audits/${auditId}`)
      return { audit: detail.audit, items: detail.items.map(i => ({ ...i, coverUri: coverUri(i.coverPath, i.coverUrl) })) }
    },
  })
}

function useAuditMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => invalidateLibraryData(client) })
}

export function useStartAudit() {
  return useAuditMutation(async ({ libraryId, mode, size, shelfId }: { libraryId: string, mode: AuditMode, size?: number, shelfId?: string }) =>
    (await api.post<{ id: string }>(`/libraries/${libraryId}/audits`, { mode, size: size ?? 10, shelfId })).id)
}

export function useRecordAuditItem(libraryId: string) {
  return useAuditMutation(({ itemId, result, foundShelfId, move }: { itemId: string, result: AuditResult, foundShelfId?: string, move?: boolean }) =>
    api.post(`/libraries/${libraryId}/audits/items/${itemId}`, { result, foundShelfId: foundShelfId ?? null, move: move ?? false }))
}

export function useRecordAuditScan(libraryId: string) {
  return useAuditMutation(({ auditId, isbn, bookId }: { auditId: string, isbn?: string, bookId?: string }) =>
    api.post<{ itemId: string, bookId: string | null, result: AuditResult, already: boolean }>(`/libraries/${libraryId}/audits/${auditId}/scan`, { isbn, bookId }))
}

export function useCompleteAudit(libraryId: string) {
  return useAuditMutation((auditId: string) => api.post<Record<AuditResult, number>>(`/libraries/${libraryId}/audits/${auditId}/complete`))
}
