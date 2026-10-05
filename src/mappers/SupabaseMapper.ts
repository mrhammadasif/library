import type { ColorName } from '~/constants/BookColors'
import type { Permission } from '~/constants/Permissions'
import type { IAudit, IAuditItem, AuditResult, AuditMode } from '~/models/IAudit'
import type { BookEventType, BookStatus, IBook, IBookEvent, IBookFields } from '~/models/IBook'
import type { AiProvider, IAiProviderConfig, IInvite, IMember, IMembership } from '~/models/ILibrary'
import type { ILoan } from '~/models/ILoan'
import type { IRack } from '~/models/IShelf'
import { ALL_PERMISSIONS } from '~/constants/Permissions'

// ─── Row shapes (snake_case, as PostgREST returns them) ─────────────────────

export interface IBookRow {
  id: string
  library_id: string
  isbn13: string | null
  isbn10: string | null
  title: string
  subtitle: string | null
  authors: string[]
  publisher: string | null
  published_year: number | null
  pages: number | null
  language: string | null
  description: string | null
  categories: string[]
  tags: string[]
  cover_path: string | null
  cover_url: string | null
  dominant_color: string | null
  color_name: ColorName | null
  condition: string | null
  notes: string | null
  status: BookStatus
  shelf_id: string | null
  archived_at: string | null
  archive_reason: string | null
  donated_to: string | null
  last_seen_at: string | null
  created_at: string
}

/** Columns the app reads (skips the generated search/authors_text columns). */
export const BOOK_COLUMNS = 'id, library_id, isbn13, isbn10, title, subtitle, authors, publisher, published_year, pages, '
  + 'language, description, categories, tags, cover_path, cover_url, dominant_color, color_name, condition, notes, status, '
  + 'shelf_id, archived_at, archive_reason, donated_to, last_seen_at, created_at'

export function toBook(row: IBookRow): IBook {
  return {
    id: row.id,
    libraryId: row.library_id,
    isbn13: row.isbn13,
    isbn10: row.isbn10,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors ?? [],
    publisher: row.publisher,
    publishedYear: row.published_year,
    pages: row.pages,
    language: row.language,
    description: row.description,
    categories: row.categories ?? [],
    tags: row.tags ?? [],
    coverPath: row.cover_path,
    coverUrl: row.cover_url,
    dominantColor: row.dominant_color,
    colorName: row.color_name,
    condition: row.condition,
    notes: row.notes,
    status: row.status,
    shelfId: row.shelf_id,
    archivedAt: row.archived_at,
    archiveReason: row.archive_reason,
    donatedTo: row.donated_to,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  }
}

/** Editable fields → snake_case payload for add_book / update. Blank strings become null. */
export function toBookPayload(fields: IBookFields): Record<string, unknown> {
  const text = (v: string | null) => (v && v.trim() ? v.trim() : null)
  const list = (v: string[]) => v.map(s => s.trim()).filter(Boolean)
  return {
    isbn13: text(fields.isbn13),
    isbn10: text(fields.isbn10),
    title: fields.title.trim(),
    subtitle: text(fields.subtitle),
    authors: list(fields.authors),
    publisher: text(fields.publisher),
    published_year: fields.publishedYear,
    pages: fields.pages,
    language: text(fields.language),
    description: text(fields.description),
    categories: list(fields.categories),
    tags: [...new Set(list(fields.tags).map(t => t.toLowerCase()))],
    cover_path: fields.coverPath,
    cover_url: fields.coverUrl,
    dominant_color: fields.dominantColor,
    color_name: fields.colorName,
    condition: text(fields.condition),
    notes: text(fields.notes),
  }
}

interface IMembershipRow {
  role: 'owner' | 'member'
  permissions: Permission[]
  library: { id: string, name: string, enrich_provider: AiProvider | null, vision_provider: AiProvider | null } | null
}

export function toMembership(row: IMembershipRow): IMembership | null {
  if (!row.library) {
    return null
  }
  return {
    library: {
      id: row.library.id,
      name: row.library.name,
      enrichProvider: row.library.enrich_provider,
      visionProvider: row.library.vision_provider,
    },
    role: row.role,
    permissions: row.role === 'owner' ? ALL_PERMISSIONS : row.permissions,
  }
}

interface IMemberRow {
  user_id: string
  role: 'owner' | 'member'
  permissions: Permission[]
  created_at: string
  profile: { display_name: string } | null
}

export function toMember(row: IMemberRow): IMember {
  return {
    userId: row.user_id,
    displayName: row.profile?.display_name || 'Member',
    role: row.role,
    permissions: row.permissions,
    joinedAt: row.created_at,
  }
}

interface IInviteRow {
  id: string
  code: string
  permissions: Permission[]
  expires_at: string
  max_uses: number
  uses: number
}

export function toInvite(row: IInviteRow): IInvite {
  return { id: row.id, code: row.code, permissions: row.permissions, expiresAt: row.expires_at, maxUses: row.max_uses, uses: row.uses }
}

interface IRackRow {
  id: string
  name: string
  notes: string | null
  position: number
  shelves: { id: string, rack_id: string, name: string, notes: string | null, position: number, books: { count: number }[] }[]
}

export function toRack(row: IRackRow): IRack {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    position: row.position,
    shelves: [...row.shelves]
      .sort((a, b) => a.position - b.position)
      .map(s => ({ id: s.id, rackId: s.rack_id, name: s.name, notes: s.notes, position: s.position, bookCount: s.books[0]?.count ?? 0 })),
  }
}

interface ILoanRow {
  id: string
  book_id: string
  borrower_user_id: string | null
  borrower_name: string
  borrower_contact: string | null
  notes: string | null
  lent_at: string
  due_at: string | null
  returned_at: string | null
  book: { title: string } | null
}

export function toLoan(row: ILoanRow): ILoan {
  return {
    id: row.id,
    bookId: row.book_id,
    bookTitle: row.book?.title ?? '',
    borrowerUserId: row.borrower_user_id,
    borrowerName: row.borrower_name,
    borrowerContact: row.borrower_contact,
    notes: row.notes,
    lentAt: row.lent_at,
    dueAt: row.due_at,
    returnedAt: row.returned_at,
  }
}

interface IEventRow {
  id: number
  type: BookEventType
  from_shelf_id: string | null
  to_shelf_id: string | null
  payload: Record<string, unknown>
  at: string
  actor_profile: { display_name: string } | null
}

export function toEvent(row: IEventRow): IBookEvent {
  return {
    id: row.id,
    type: row.type,
    fromShelfId: row.from_shelf_id,
    toShelfId: row.to_shelf_id,
    payload: row.payload ?? {},
    actorName: row.actor_profile?.display_name ?? null,
    at: row.at,
  }
}

interface IAuditRow {
  id: string
  mode: AuditMode
  shelf_id: string | null
  sample_size: number | null
  started_at: string
  completed_at: string | null
  items: { result: AuditResult }[]
}

export function toAudit(row: IAuditRow): IAudit {
  const counts: Record<AuditResult, number> = { pending: 0, found: 0, missing: 0, misplaced: 0, unexpected: 0 }
  for (const item of row.items ?? []) {
    counts[item.result] += 1
  }
  return {
    id: row.id,
    mode: row.mode,
    shelfId: row.shelf_id,
    sampleSize: row.sample_size,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    counts,
  }
}

interface IAuditItemRow {
  id: string
  book_id: string | null
  expected_shelf_id: string | null
  found_shelf_id: string | null
  scanned_isbn: string | null
  result: AuditResult
  book: Pick<IBookRow, 'title' | 'authors' | 'cover_path' | 'cover_url' | 'dominant_color'> | null
}

export function toAuditItem(row: IAuditItemRow, coverUri: (path: string | null, url: string | null) => string | null): IAuditItem {
  return {
    id: row.id,
    bookId: row.book_id,
    bookTitle: row.book?.title ?? null,
    bookAuthors: row.book?.authors ?? [],
    coverUri: row.book ? coverUri(row.book.cover_path, row.book.cover_url) : null,
    dominantColor: row.book?.dominant_color ?? null,
    expectedShelfId: row.expected_shelf_id,
    foundShelfId: row.found_shelf_id,
    scannedIsbn: row.scanned_isbn,
    result: row.result,
  }
}

interface IAiProviderRow {
  provider: AiProvider
  model: string
  base_url: string | null
  supports_vision: boolean
  has_key: boolean
}

export function toAiProvider(row: IAiProviderRow): IAiProviderConfig {
  return { provider: row.provider, model: row.model, baseUrl: row.base_url, supportsVision: row.supports_vision, hasKey: row.has_key }
}
