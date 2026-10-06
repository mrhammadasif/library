import type { IBookDto, IBookEventDto } from '../../../shared/contracts/Books'
import type { IMembership } from '../auth/Access'
import type { BookEventType, BookStatus, Prisma, PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { BookFieldsInput, ListBooksQuery } from '../../../shared/contracts/Books'
import { requirePermission } from '../auth/Permissions'
import { DomainError, notFound } from '../common/DomainError'
import { InjectPrisma } from '../prisma/Prisma'
import { lockBook, lockBooks } from './BookLocks'
import { toBookDto } from './BookMapper'

type IBookFields = z.output<typeof BookFieldsInput>

export const STATUS_WORDS: Record<BookStatus, string> = { on_shelf: 'on the shelf', borrowed: 'borrowed', missing: 'missing', archived: 'given away' }

/** Metadata columns + the search helper column kept in sync with authors. */
function fieldData(f: IBookFields) {
  return { ...f, authorsText: f.authors.join(' ') }
}

export async function requireShelf(db: Prisma.TransactionClient | PrismaClient, libraryId: string, shelfId: string): Promise<void> {
  if (!await db.shelf.findFirst({ where: { id: shelfId, libraryId }, select: { id: true } })) {
    throw new DomainError(404, 'shelf_not_found', 'Choose a shelf in this library')
  }
}

export function event(libraryId: string, bookId: string, type: BookEventType, actor: string, extra: { fromShelfId?: string | null, toShelfId?: string | null, payload?: Record<string, unknown> } = {}) {
  return { libraryId, bookId, type, actor, fromShelfId: extra.fromShelfId ?? null, toShelfId: extra.toShelfId ?? null, payload: (extra.payload ?? {}) as Prisma.InputJsonValue }
}

@Injectable()
export class BooksService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async list(libraryId: string, q: z.output<typeof ListBooksQuery>): Promise<IBookDto[]> {
    const orderBy: Prisma.BookOrderByWithRelationInput[] = q.order === 'recent'
      ? [{ createdAt: 'desc' }]
      : q.order === 'archived' ? [{ archivedAt: 'desc' }] : [{ title: 'asc' }]
    const rows = await this.prisma.book.findMany({
      where: {
        libraryId,
        ...(q.shelfId ? { shelfId: q.shelfId } : {}),
        ...(q.isbn ? { isbn13: q.isbn } : {}),
        status: q.status ?? (q.shelfId || q.isbn ? undefined : { not: 'archived' }),
      },
      orderBy,
      take: q.limit,
    })
    return rows.map(toBookDto)
  }

  async get(libraryId: string, id: string): Promise<IBookDto> {
    const book = await this.prisma.book.findFirst({ where: { id, libraryId } })
    if (!book) {
      throw notFound('Book')
    }
    return toBookDto(book)
  }

  async events(libraryId: string, bookId: string): Promise<IBookEventDto[]> {
    const rows = await this.prisma.bookEvent.findMany({ where: { libraryId, bookId }, orderBy: { at: 'desc' }, take: 50 })
    const actors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map(r => r.actor).filter((a): a is string => !!a))] } }, select: { id: true, name: true } })
    return rows.map(r => ({
      id: r.id.toString(),
      type: r.type,
      fromShelfId: r.fromShelfId,
      toShelfId: r.toShelfId,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      actorName: actors.find(a => a.id === r.actor)?.name ?? null,
      at: r.at.toISOString(),
    }))
  }

  async add(m: IMembership, input: { id?: string, shelfId: string, book: IBookFields }): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      await requireShelf(tx, m.libraryId, input.shelfId)
      const book = await tx.book.create({
        data: { ...fieldData(input.book), id: input.id, libraryId: m.libraryId, shelfId: input.shelfId, status: 'on_shelf', lastSeenAt: new Date(), addedBy: m.userId },
        select: { id: true },
      })
      await tx.bookEvent.create({ data: event(m.libraryId, book.id, 'created', m.userId, { toShelfId: input.shelfId }) })
      return book
    })
  }

  async update(libraryId: string, id: string, fields: IBookFields): Promise<void> {
    const { count } = await this.prisma.book.updateMany({ where: { id, libraryId }, data: fieldData(fields) })
    if (!count) {
      throw notFound('Book')
    }
  }

  async remove(libraryId: string, id: string): Promise<void> {
    const { count } = await this.prisma.book.deleteMany({ where: { id, libraryId } })
    if (!count) {
      throw notFound('Book')
    }
  }

  /** Moves books (not given-away ones) to a shelf; already-there books are skipped. Returns how many moved. */
  async move(m: IMembership, bookIds: string[], shelfId: string): Promise<{ count: number }> {
    return this.prisma.$transaction(async (tx) => {
      await requireShelf(tx, m.libraryId, shelfId)
      const books = (await lockBooks(tx, m.libraryId, bookIds)).filter(b => b.status !== 'archived' && b.shelf_id !== shelfId)
      if (!books.length) {
        return { count: 0 }
      }
      await tx.book.updateMany({ where: { id: { in: books.map(b => b.id) } }, data: { shelfId } })
      await tx.bookEvent.createMany({ data: books.map(b => event(m.libraryId, b.id, 'moved', m.userId, { fromShelfId: b.shelf_id, toShelfId: shelfId })) })
      return { count: books.length }
    })
  }

  /** Takes books off the shelves (donated by default) and closes any open loan; history stays. */
  async archive(m: IMembership, input: { bookIds: string[], reason: string, recipient?: string | null, note?: string | null }): Promise<{ count: number }> {
    return this.prisma.$transaction(async (tx) => {
      const books = (await lockBooks(tx, m.libraryId, input.bookIds)).filter(b => b.status !== 'archived')
      if (!books.length) {
        return { count: 0 }
      }
      const ids = books.map(b => b.id)
      const recipient = input.reason === 'donated' ? input.recipient?.trim() || null : null
      await tx.loan.updateMany({ where: { bookId: { in: ids }, returnedAt: null }, data: { returnedAt: new Date(), returnedBy: m.userId, notes: 'closed when given away' } })
      await tx.book.updateMany({ where: { id: { in: ids } }, data: { status: 'archived', shelfId: null, archivedAt: new Date(), archiveReason: input.reason, donatedTo: recipient } })
      const payload = Object.fromEntries(Object.entries({ reason: input.reason, recipient, note: input.note?.trim() || null }).filter(([, v]) => v))
      await tx.bookEvent.createMany({ data: books.map(b => event(m.libraryId, b.id, 'archived', m.userId, { fromShelfId: b.shelf_id, payload })) })
      return { count: books.length }
    })
  }

  async restore(m: IMembership, bookId: string, shelfId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const book = await lockBook(tx, m.libraryId, bookId)
      if (!book) {
        throw notFound('Book')
      }
      if (book.status !== 'archived') {
        throw new DomainError(409, 'not_archived', 'This book is still in the library')
      }
      await requireShelf(tx, m.libraryId, shelfId)
      await tx.book.update({ where: { id: bookId }, data: { status: 'on_shelf', shelfId, archivedAt: null, archiveReason: null, donatedTo: null, lastSeenAt: new Date() } })
      await tx.bookEvent.create({ data: event(m.libraryId, bookId, 'restored', m.userId, { toShelfId: shelfId }) })
    })
  }

  /** Someone spotted a missing book: back on its home shelf (or another shelf, which also needs books.move). */
  async markFound(m: IMembership, bookId: string, shelfId?: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const book = await lockBook(tx, m.libraryId, bookId)
      if (!book) {
        throw notFound('Book')
      }
      if (book.status !== 'missing') {
        throw new DomainError(409, 'not_missing', `This book is ${STATUS_WORDS[book.status]}, not missing`)
      }
      const target = shelfId ?? book.shelf_id
      if (target !== book.shelf_id) {
        requirePermission(m, 'books.move')
        await requireShelf(tx, m.libraryId, target!)
        await tx.bookEvent.create({ data: event(m.libraryId, bookId, 'moved', m.userId, { fromShelfId: book.shelf_id, toShelfId: target }) })
      }
      await tx.book.update({ where: { id: bookId }, data: { status: 'on_shelf', shelfId: target, lastSeenAt: new Date() } })
      await tx.bookEvent.create({ data: event(m.libraryId, bookId, 'audited', m.userId, { payload: { result: 'found' } }) })
    })
  }
}
