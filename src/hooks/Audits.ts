import type { AuditMode, AuditResult, IAudit, IAuditItem } from '~/models/IAudit'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { coverUri, getSupabase, unwrap } from '~/api/Supabase'
import { invalidateLibraryData } from '~/hooks/Invalidate'
import { toAudit, toAuditItem } from '~/mappers/SupabaseMapper'

const AUDIT_COLUMNS = 'id, mode, shelf_id, sample_size, started_at, completed_at, items:audit_items(result)'

export function useAudits(libraryId: string) {
  return useQuery({
    queryKey: ['audits', libraryId],
    queryFn: async (): Promise<IAudit[]> => {
      const rows = unwrap(await getSupabase().from('audits').select(AUDIT_COLUMNS)
        .eq('library_id', libraryId).order('started_at', { ascending: false }).limit(30))
      return (rows as unknown as Parameters<typeof toAudit>[0][]).map(toAudit)
    },
  })
}

export function useAudit(auditId: string) {
  return useQuery({
    queryKey: ['audit', auditId],
    queryFn: async (): Promise<{ audit: IAudit, items: IAuditItem[] }> => {
      const supabase = getSupabase()
      const [audit, items] = await Promise.all([
        supabase.from('audits').select(AUDIT_COLUMNS).eq('id', auditId).single(),
        supabase.from('audit_items')
          .select('id, book_id, expected_shelf_id, found_shelf_id, scanned_isbn, result, book:books(title, authors, cover_path, cover_url, dominant_color)')
          .eq('audit_id', auditId),
      ])
      const itemRows = unwrap(items) as unknown as Parameters<typeof toAuditItem>[0][]
      return {
        audit: toAudit(unwrap(audit) as unknown as Parameters<typeof toAudit>[0]),
        items: itemRows.map(row => toAuditItem(row, coverUri))
          .sort((a, b) => (a.bookTitle ?? '').localeCompare(b.bookTitle ?? '')),
      }
    },
  })
}

function useAuditMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient()
  return useMutation({ mutationFn: fn, onSettled: () => invalidateLibraryData(client) })
}

export function useStartAudit() {
  return useAuditMutation(async ({ libraryId, mode, size, shelfId }: { libraryId: string, mode: AuditMode, size?: number, shelfId?: string }) =>
    unwrap(await getSupabase().rpc('start_audit', {
      p_library: libraryId,
      p_mode: mode,
      p_size: size ?? 10,
      p_shelf: shelfId ?? null,
    })) as string)
}

export function useRecordAuditItem() {
  return useAuditMutation(async ({ itemId, result, foundShelfId, move }: { itemId: string, result: AuditResult, foundShelfId?: string, move?: boolean }) => {
    unwrap(await getSupabase().rpc('record_audit_item', {
      p_item: itemId,
      p_result: result,
      p_found_shelf: foundShelfId ?? null,
      p_move: move ?? false,
    }))
  })
}

export function useRecordAuditScan() {
  return useAuditMutation(async ({ auditId, isbn, bookId }: { auditId: string, isbn?: string, bookId?: string }) =>
    unwrap(await getSupabase().rpc('record_audit_scan', { p_audit: auditId, p_isbn: isbn ?? null, p_book: bookId ?? null })) as
      { item_id: string, book_id: string | null, result: AuditResult, already: boolean })
}

export function useCompleteAudit() {
  return useAuditMutation(async (auditId: string) =>
    unwrap(await getSupabase().rpc('complete_audit', { p_audit: auditId })) as Record<AuditResult, number>)
}
