export type AuditMode = 'random' | 'shelf'
export type AuditResult = 'pending' | 'found' | 'missing' | 'misplaced' | 'unexpected'

export interface IAudit {
  id: string
  mode: AuditMode
  shelfId: string | null
  sampleSize: number | null
  startedAt: string
  completedAt: string | null
  counts: Record<AuditResult, number>
}

export interface IAuditItem {
  id: string
  bookId: string | null
  bookTitle: string | null
  bookAuthors: string[]
  coverUri: string | null
  dominantColor: string | null
  expectedShelfId: string | null
  foundShelfId: string | null
  scannedIsbn: string | null
  result: AuditResult
}
