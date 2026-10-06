import type { IAuditDto, IAuditItemDto } from '../../../shared/contracts/Audits'
import type { IMembership } from '../auth/Access'
import type { AuditMode, AuditResult, Prisma, PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { requirePermission } from '../auth/Permissions'
import { event, requireShelf } from '../books/BooksService'
import { DomainError, notFound } from '../common/DomainError'
import { InjectPrisma } from '../prisma/Prisma'

const RESULTS: AuditResult[] = ['pending', 'found', 'missing', 'misplaced', 'unexpected']

function counts(items: { result: AuditResult }[]): Record<AuditResult, number> {
  const out = Object.fromEntries(RESULTS.map(r => [r, 0])) as Record<AuditResult, number>
  for (const item of items) {
    out[item.result] += 1
  }
  return out
}

function toAuditDto(a: { id: string, mode: AuditMode, shelfId: string | null, sampleSize: number | null, startedAt: Date, completedAt: Date | null, items: { result: AuditResult }[] }): IAuditDto {
  return { id: a.id, mode: a.mode, shelfId: a.shelfId, sampleSize: a.sampleSize, startedAt: a.startedAt.toISOString(), completedAt: a.completedAt?.toISOString() ?? null, counts: counts(a.items) }
}

@Injectable()
export class AuditsService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async list(libraryId: string): Promise<IAuditDto[]> {
    const rows = await this.prisma.audit.findMany({ where: { libraryId }, orderBy: { startedAt: 'desc' }, take: 30, include: { items: { select: { result: true } } } })
    return rows.map(toAuditDto)
  }

  async get(libraryId: string, auditId: string): Promise<{ audit: IAuditDto, items: IAuditItemDto[] }> {
    const audit = await this.prisma.audit.findFirst({
      where: { id: auditId, libraryId },
      include: { items: { include: { book: { select: { title: true, authors: true, coverPath: true, coverUrl: true, dominantColor: true } } } } },
    })
    if (!audit) {
      throw notFound('Check')
    }
    const items = audit.items.map(i => ({
      id: i.id,
      bookId: i.bookId,
      bookTitle: i.book?.title ?? null,
      bookAuthors: i.book?.authors ?? [],
      coverPath: i.book?.coverPath ?? null,
      coverUrl: i.book?.coverUrl ?? null,
      dominantColor: i.book?.dominantColor ?? null,
      expectedShelfId: i.expectedShelfId,
      foundShelfId: i.foundShelfId,
      scannedIsbn: i.scannedIsbn,
      result: i.result,
    })).sort((a, b) => (a.bookTitle ?? '').localeCompare(b.bookTitle ?? ''))
    return { audit: toAuditDto(audit), items }
  }

  /** random: `size` books weighted toward those unseen the longest. shelf: every book expected on the shelf. */
  async start(m: IMembership, input: { mode: AuditMode, size: number, shelfId?: string }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      if (input.mode === 'shelf') {
        await requireShelf(tx, m.libraryId, input.shelfId!)
      }
      const books = input.mode === 'random'
        ? await tx.$queryRaw<{ id: string, shelf_id: string }[]>`
            SELECT id, shelf_id FROM books
            WHERE library_id = ${m.libraryId}::uuid AND status IN ('on_shelf', 'missing')
            ORDER BY random() * (extract(epoch FROM now() - coalesce(last_seen_at, created_at)) + 86400) DESC
            LIMIT ${input.size}`
        : await tx.$queryRaw<{ id: string, shelf_id: string }[]>`
            SELECT id, shelf_id FROM books
            WHERE library_id = ${m.libraryId}::uuid AND shelf_id = ${input.shelfId}::uuid AND status IN ('on_shelf', 'missing')`
      if (input.mode === 'random' && !books.length) {
        throw new DomainError(409, 'nothing_to_check', 'There are no books on shelves to check yet')
      }
      const audit = await tx.audit.create({
        data: {
          libraryId: m.libraryId,
          mode: input.mode,
          shelfId: input.mode === 'shelf' ? input.shelfId : null,
          sampleSize: input.mode === 'random' ? input.size : null,
          startedBy: m.userId,
        },
        select: { id: true },
      })
      // Not a nested create: items carry a composite FK (audit_id, library_id) that Prisma can't fill from the relation.
      await tx.auditItem.createMany({ data: books.map(b => ({ libraryId: m.libraryId, auditId: audit.id, bookId: b.id, expectedShelfId: b.shelf_id })) })
      return audit
    })
  }

  /** One answer. found/misplaced mark the book seen (and un-missing); misplaced + move re-homes it (needs books.move). */
  async record(m: IMembership, itemId: string, input: { result: 'found' | 'missing' | 'misplaced' | 'pending', foundShelfId?: string | null, move: boolean }): Promise<void> {
    await this.prisma.$transaction(async tx => this.recordIn(tx, m, itemId, input))
  }

  private async recordIn(tx: Prisma.TransactionClient, m: IMembership, itemId: string, input: { result: 'found' | 'missing' | 'misplaced' | 'pending', foundShelfId?: string | null, move: boolean }): Promise<void> {
    const [item] = await tx.$queryRaw<{ id: string, audit_id: string, book_id: string | null, expected_shelf_id: string | null }[]>`
      SELECT id, audit_id, book_id, expected_shelf_id FROM audit_items WHERE id = ${itemId}::uuid AND library_id = ${m.libraryId}::uuid FOR UPDATE`
    if (!item) {
      throw notFound('Check item')
    }
    await this.requireOpen(tx, item.audit_id)
    if (input.result === 'misplaced') {
      if (!input.foundShelfId) {
        throw new DomainError(400, 'shelf_required', 'Which shelf was the book on?')
      }
      await requireShelf(tx, m.libraryId, input.foundShelfId)
    }
    const checked = input.result !== 'pending'
    await tx.auditItem.update({
      where: { id: itemId },
      data: {
        result: input.result,
        foundShelfId: input.result === 'misplaced' ? input.foundShelfId : input.result === 'found' ? item.expected_shelf_id : null,
        checkedAt: checked ? new Date() : null,
        checkedBy: checked ? m.userId : null,
      },
    })
    if (!item.book_id || !checked) {
      return
    }
    if (input.result === 'found' || input.result === 'misplaced') {
      const book = await tx.book.findUniqueOrThrow({ where: { id: item.book_id }, select: { shelfId: true, status: true } })
      const moving = input.result === 'misplaced' && input.move && book.shelfId !== input.foundShelfId
      if (moving) {
        requirePermission(m, 'books.move')
        await tx.bookEvent.create({ data: event(m.libraryId, item.book_id, 'moved', m.userId, { fromShelfId: book.shelfId, toShelfId: input.foundShelfId, payload: { auditId: item.audit_id } }) })
      }
      await tx.book.update({
        where: { id: item.book_id },
        data: { lastSeenAt: new Date(), status: book.status === 'missing' ? 'on_shelf' : book.status, ...(moving ? { shelfId: input.foundShelfId } : {}) },
      })
    }
    await tx.bookEvent.create({ data: event(m.libraryId, item.book_id, 'audited', m.userId, { payload: { auditId: item.audit_id, result: input.result } }) })
  }

  /** Shelf inventory scanning: expected books are marked found; books from elsewhere or unknown ISBNs are 'unexpected'. */
  async scan(m: IMembership, auditId: string, input: { isbn?: string, bookId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const audit = await this.requireOpen(tx, auditId, m.libraryId)
      const match = { OR: [input.bookId ? { id: input.bookId } : { isbn13: input.isbn }] }
      const item = await tx.auditItem.findFirst({
        where: { auditId, book: match },
        orderBy: { result: 'asc' },
      })
      if (item) {
        const already = item.result !== 'pending'
        if (!already) {
          await this.recordIn(tx, m, item.id, { result: 'found', move: false })
        }
        return { itemId: item.id, bookId: item.bookId, result: 'found' as const, already }
      }
      const book = await tx.book.findFirst({ where: { libraryId: m.libraryId, status: { not: 'archived' }, ...match } })
      const created = await tx.auditItem.create({
        data: { libraryId: m.libraryId, auditId, bookId: book?.id ?? null, expectedShelfId: book?.shelfId ?? null, foundShelfId: audit.shelfId, scannedIsbn: input.isbn ?? null, result: 'unexpected', checkedAt: new Date(), checkedBy: m.userId },
      })
      if (book) {
        await tx.book.update({ where: { id: book.id }, data: { lastSeenAt: new Date(), status: book.status === 'missing' ? 'on_shelf' : book.status } })
        await tx.bookEvent.create({ data: event(m.libraryId, book.id, 'audited', m.userId, { payload: { auditId, result: 'unexpected', foundShelfId: audit.shelfId } }) })
      }
      return { itemId: created.id, bookId: book?.id ?? null, result: 'unexpected' as const, already: false }
    })
  }

  /** Unchecked items become missing, and their books are flagged missing until seen again. */
  async complete(m: IMembership, auditId: string): Promise<Record<AuditResult, number>> {
    return this.prisma.$transaction(async (tx) => {
      await this.requireOpen(tx, auditId, m.libraryId, true)
      const now = new Date()
      await tx.auditItem.updateMany({ where: { auditId, result: 'pending' }, data: { result: 'missing', checkedAt: now, checkedBy: m.userId } })
      const missing = await tx.auditItem.findMany({ where: { auditId, result: 'missing', book: { status: 'on_shelf' } }, select: { bookId: true } })
      const ids = missing.map(i => i.bookId!).filter(Boolean)
      if (ids.length) {
        await tx.book.updateMany({ where: { id: { in: ids } }, data: { status: 'missing' } })
        await tx.bookEvent.createMany({ data: ids.map(id => event(m.libraryId, id, 'marked_missing', m.userId, { payload: { auditId } })) })
      }
      await tx.audit.update({ where: { id: auditId }, data: { completedAt: now } })
      return counts(await tx.auditItem.findMany({ where: { auditId }, select: { result: true } }))
    })
  }

  private async requireOpen(tx: Prisma.TransactionClient, auditId: string, libraryId?: string, lock = false) {
    const rows = lock
      ? await tx.$queryRaw<{ id: string, library_id: string, shelf_id: string | null, completed_at: Date | null }[]>`SELECT id, library_id, shelf_id, completed_at FROM audits WHERE id = ${auditId}::uuid FOR UPDATE`
      : await tx.$queryRaw<{ id: string, library_id: string, shelf_id: string | null, completed_at: Date | null }[]>`SELECT id, library_id, shelf_id, completed_at FROM audits WHERE id = ${auditId}::uuid`
    const audit = rows[0]
    if (!audit || (libraryId && audit.library_id !== libraryId)) {
      throw notFound('Check')
    }
    if (audit.completed_at) {
      throw new DomainError(409, 'audit_completed', 'This check is already finished')
    }
    return { id: audit.id, shelfId: audit.shelf_id }
  }
}
