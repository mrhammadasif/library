import type { ILoanDto } from '../../../shared/contracts/Loans'
import type { IMembership } from '../auth/Access'
import type { PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { requirePermission } from '../auth/Permissions'
import { lockBook } from '../books/BookLocks'
import { event, requireShelf, STATUS_WORDS } from '../books/BooksService'
import { DomainError, notFound } from '../common/DomainError'
import { InjectPrisma } from '../prisma/Prisma'

interface ILendInput {
  borrowerUserId?: string | null
  borrowerName?: string | null
  contact?: string | null
  dueAt?: string | null
  notes?: string | null
}

@Injectable()
export class LoansService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  /** Open loans soonest-due first, or a book's loan history. */
  async list(libraryId: string, q: { open?: boolean, bookId?: string }): Promise<ILoanDto[]> {
    const rows = await this.prisma.loan.findMany({
      where: { libraryId, ...(q.bookId ? { bookId: q.bookId } : {}), ...(q.open ? { returnedAt: null } : {}) },
      include: { book: { select: { title: true } } },
      orderBy: q.open ? [{ dueAt: { sort: 'asc', nulls: 'last' } }] : [{ lentAt: 'desc' }],
      take: 500,
    })
    return rows.map(l => ({
      id: l.id,
      bookId: l.bookId,
      bookTitle: l.book.title,
      borrowerUserId: l.borrowerUserId,
      borrowerName: l.borrowerName,
      borrowerContact: l.borrowerContact,
      notes: l.notes,
      lentAt: l.lentAt.toISOString(),
      dueAt: l.dueAt?.toISOString() ?? null,
      returnedAt: l.returnedAt?.toISOString() ?? null,
    }))
  }

  async lend(m: IMembership, bookId: string, input: ILendInput): Promise<{ id: string }> {
    return this.prisma.$transaction(async (tx) => {
      const book = await lockBook(tx, m.libraryId, bookId)
      if (!book) {
        throw notFound('Book')
      }
      // A missing book can turn out to be with someone: lending it records who has it (missing → borrowed).
      if (book.status !== 'on_shelf' && book.status !== 'missing') {
        throw new DomainError(409, 'not_on_shelf', `Only books on a shelf (or missing) can be borrowed (this one is ${STATUS_WORDS[book.status]})`)
      }
      let name = input.borrowerName?.trim() || null
      if (input.borrowerUserId) {
        const member = await tx.libraryMember.findUnique({
          where: { libraryId_userId: { libraryId: m.libraryId, userId: input.borrowerUserId } },
          include: { user: { select: { name: true } } },
        })
        if (!member) {
          throw new DomainError(400, 'not_a_member', 'The borrower isn\'t a member of this library')
        }
        name ??= member.user.name
      }
      if (!name) {
        throw new DomainError(400, 'borrower_required', 'Who is borrowing the book?')
      }
      const loan = await tx.loan.create({
        data: {
          libraryId: m.libraryId,
          bookId,
          borrowerUserId: input.borrowerUserId ?? null,
          borrowerName: name,
          borrowerContact: input.contact?.trim() || null,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          notes: input.notes?.trim() || null,
          lentBy: m.userId,
        },
        select: { id: true },
      })
      await tx.book.update({ where: { id: bookId }, data: { status: 'borrowed' } })
      await tx.bookEvent.create({ data: event(m.libraryId, bookId, 'lent', m.userId, { fromShelfId: book.shelf_id, payload: { loanId: loan.id, borrower: name, dueAt: input.dueAt ?? null } }) })
      return loan
    })
  }

  /** Back to its home shelf, or to `shelfId` (which also needs books.move). */
  async giveBack(m: IMembership, bookId: string, shelfId?: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const book = await lockBook(tx, m.libraryId, bookId)
      if (!book) {
        throw notFound('Book')
      }
      if (book.status !== 'borrowed') {
        throw new DomainError(409, 'not_borrowed', 'This book isn\'t borrowed')
      }
      const target = shelfId ?? book.shelf_id!
      if (target !== book.shelf_id) {
        requirePermission(m, 'books.move')
        await requireShelf(tx, m.libraryId, target)
      }
      await tx.loan.updateMany({ where: { bookId, returnedAt: null }, data: { returnedAt: new Date(), returnedBy: m.userId, returnShelfId: target } })
      await tx.book.update({ where: { id: bookId }, data: { status: 'on_shelf', shelfId: target, lastSeenAt: new Date() } })
      await tx.bookEvent.create({ data: event(m.libraryId, bookId, 'returned', m.userId, { fromShelfId: book.shelf_id, toShelfId: target }) })
    })
  }
}
