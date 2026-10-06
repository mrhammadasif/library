import type { BookStatus, Prisma } from '../generated/prisma/client'
import { Prisma as P } from '../generated/prisma/client'

export interface ILockedBook {
  id: string
  status: BookStatus
  shelf_id: string | null
  title: string
}

/** Row-locks books of one library for the rest of the transaction (concurrent lend/return/move can't interleave). */
export async function lockBooks(tx: Prisma.TransactionClient, libraryId: string, ids: string[]): Promise<ILockedBook[]> {
  if (!ids.length) {
    return []
  }
  return tx.$queryRaw<ILockedBook[]>`
    SELECT id, status, shelf_id, title FROM books
    WHERE library_id = ${libraryId}::uuid AND id IN (${P.join(ids.map(id => P.sql`${id}::uuid`))})
    ORDER BY id
    FOR UPDATE`
}

export async function lockBook(tx: Prisma.TransactionClient, libraryId: string, id: string): Promise<ILockedBook | null> {
  return (await lockBooks(tx, libraryId, [id]))[0] ?? null
}
