import type { IBookDto } from '../../../shared/contracts/Books'
import type { ILibraryStatsDto } from '../../../shared/contracts/Search'
import type { PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { SearchBooksQuery } from '../../../shared/contracts/Search'
import { toBookDto } from '../books/BookMapper'
import { Prisma } from '../generated/prisma/client'
import { InjectPrisma } from '../prisma/Prisma'

type ISearchQuery = z.output<typeof SearchBooksQuery>

// Built on the fly instead of a stored column: per-library sets are small and this keeps Prisma diffs clean.
const DOCUMENT = Prisma.sql`to_tsvector('simple', b.title || ' ' || coalesce(b.subtitle, '') || ' ' || b.authors_text || ' '
  || array_to_string(b.tags, ' ') || ' ' || array_to_string(b.categories, ' ') || ' ' || coalesce(b.publisher, '')
  || ' ' || coalesce(b.description, ''))`

@Injectable()
export class SearchService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  /** Full-text + fuzzy (trigram) + ISBN match, with filters. Empty query lists newest first. */
  async search(libraryId: string, q: ISearchQuery): Promise<IBookDto[]> {
    const text = q.q?.trim() || null
    const digits = text?.replace(/[^0-9Xx]/g, '').toUpperCase() ?? ''
    const where = [
      Prisma.sql`b.library_id = ${libraryId}::uuid`,
      q.status ? Prisma.sql`b.status = ${q.status}::book_status` : Prisma.sql`b.status <> 'archived'`,
      q.shelfId ? Prisma.sql`b.shelf_id = ${q.shelfId}::uuid` : Prisma.empty,
      q.color ? Prisma.sql`b.color_name = ${q.color}::color_name` : Prisma.empty,
      q.tags?.length ? Prisma.sql`b.tags @> ARRAY[${Prisma.join(q.tags)}]::text[]` : Prisma.empty,
      text
        ? Prisma.sql`(${DOCUMENT} @@ websearch_to_tsquery('simple', ${text})
            OR b.title ILIKE ${`%${text}%`} OR b.authors_text ILIKE ${`%${text}%`}
            OR similarity(b.title, ${text}) > 0.3 OR similarity(b.authors_text, ${text}) > 0.3
            ${digits.length >= 10 ? Prisma.sql`OR b.isbn13 = ${digits} OR b.isbn10 = ${digits}` : Prisma.empty})`
        : Prisma.empty,
    ].filter(part => part !== Prisma.empty)
    // No query: newest first. (A literal like `ORDER BY 0` would be read as a column position.)
    const order = text
      ? Prisma.sql`greatest(ts_rank(${DOCUMENT}, websearch_to_tsquery('simple', ${text})), similarity(b.title, ${text}), similarity(b.authors_text, ${text})) DESC, b.created_at DESC`
      : Prisma.sql`b.created_at DESC`
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT b.id FROM books b WHERE ${Prisma.join(where, ' AND ')}
      ORDER BY ${order}
      LIMIT ${q.limit} OFFSET ${q.offset}`
    const books = await this.prisma.book.findMany({ where: { id: { in: rows.map(r => r.id) } } })
    const byId = new Map(books.map(b => [b.id, b]))
    return rows.map(r => toBookDto(byId.get(r.id)!))
  }

  async tags(libraryId: string): Promise<{ tag: string, books: number }[]> {
    return this.prisma.$queryRaw`
      SELECT t AS tag, count(*)::int AS books FROM books b, unnest(b.tags) t
      WHERE b.library_id = ${libraryId}::uuid AND b.status <> 'archived'
      GROUP BY t ORDER BY books DESC, t`
  }

  async stats(libraryId: string): Promise<ILibraryStatsDto> {
    const [row] = await this.prisma.$queryRaw<{ stats: ILibraryStatsDto }[]>`
      WITH active AS (SELECT * FROM books WHERE library_id = ${libraryId}::uuid AND status <> 'archived')
      SELECT jsonb_build_object(
        'total', (SELECT count(*) FROM active),
        'archived', (SELECT count(*) FROM books WHERE library_id = ${libraryId}::uuid AND status = 'archived'),
        'byStatus', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) n FROM active GROUP BY status) s),
        'pages', (SELECT coalesce(sum(pages), 0) FROM active),
        'authors', (SELECT count(DISTINCT a) FROM active, unnest(authors) a),
        'racks', (SELECT coalesce(jsonb_agg(r ORDER BY r.position), '[]') FROM (
          SELECT rk.id, rk.name, rk.position,
            (SELECT count(*) FROM active b JOIN shelves s ON s.id = b.shelf_id WHERE s.rack_id = rk.id) AS books,
            (SELECT coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
               'books', (SELECT count(*) FROM active b WHERE b.shelf_id = s.id)) ORDER BY s.position), '[]')
             FROM shelves s WHERE s.rack_id = rk.id) AS shelves
          FROM racks rk WHERE rk.library_id = ${libraryId}::uuid) r),
        'topAuthors', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', a, 'books', n)), '[]') FROM (
          SELECT a, count(*) n FROM active, unnest(authors) a GROUP BY a ORDER BY n DESC, a LIMIT 8) x),
        'topCategories', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', c, 'books', n)), '[]') FROM (
          SELECT c, count(*) n FROM active, unnest(categories) c GROUP BY c ORDER BY n DESC, c LIMIT 8) x),
        'topTags', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', t, 'books', n)), '[]') FROM (
          SELECT t, count(*) n FROM active, unnest(tags) t GROUP BY t ORDER BY n DESC, t LIMIT 12) x),
        'colors', (SELECT coalesce(jsonb_agg(jsonb_build_object('color', color_name, 'books', n)), '[]') FROM (
          SELECT color_name, count(*) n FROM active WHERE color_name IS NOT NULL GROUP BY color_name ORDER BY n DESC) x),
        'languages', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', language, 'books', n)), '[]') FROM (
          SELECT language, count(*) n FROM active WHERE language IS NOT NULL GROUP BY language ORDER BY n DESC LIMIT 6) x),
        'decades', (SELECT coalesce(jsonb_agg(jsonb_build_object('decade', d, 'books', n) ORDER BY d), '[]') FROM (
          SELECT (published_year / 10) * 10 d, count(*) n FROM active WHERE published_year IS NOT NULL GROUP BY 1) x),
        'addedByMonth', (SELECT coalesce(jsonb_agg(jsonb_build_object('month', m, 'books', n) ORDER BY m), '[]') FROM (
          SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') m, count(*) n FROM books
          WHERE library_id = ${libraryId}::uuid AND created_at > now() - interval '12 months' GROUP BY 1) x),
        'loans', jsonb_build_object(
          'open', (SELECT count(*) FROM loans WHERE library_id = ${libraryId}::uuid AND returned_at IS NULL),
          'overdue', (SELECT count(*) FROM loans WHERE library_id = ${libraryId}::uuid AND returned_at IS NULL AND due_at < now()),
          'total', (SELECT count(*) FROM loans WHERE library_id = ${libraryId}::uuid)),
        'audit', jsonb_build_object(
          'last', (SELECT jsonb_build_object('id', a.id, 'completedAt', to_char(a.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'mode', a.mode,
                     'found', count(*) FILTER (WHERE i.result IN ('found', 'misplaced')),
                     'missing', count(*) FILTER (WHERE i.result = 'missing'),
                     'total', count(*) FILTER (WHERE i.result <> 'unexpected'))
                   FROM audits a JOIN audit_items i ON i.audit_id = a.id
                   WHERE a.id = (SELECT id FROM audits WHERE library_id = ${libraryId}::uuid AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1)
                   GROUP BY a.id),
          'unseenYear', (SELECT count(*) FROM active WHERE coalesce(last_seen_at, created_at) < now() - interval '1 year'))
      ) AS stats`
    return row.stats
  }
}
