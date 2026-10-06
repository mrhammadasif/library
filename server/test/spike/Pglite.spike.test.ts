import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { execFileSync } from 'node:child_process'
import { PrismaPGlite } from 'pglite-prisma-adapter'
import { describe, expect, it } from 'vitest'
import { PrismaClient } from '../../src/generated/prisma/client'

// Phase 0 spike: can Prisma 7.10 drive PGlite with interactive transactions, row locks, partial unique indexes and pg_trgm?
describe('pglite spike', () => {
  it('runs migrations, transactions, FOR UPDATE, partial unique and trigram search', async () => {
    const pglite = await PGlite.create({ extensions: { pg_trgm } })
    await pglite.exec('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    const sql = execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
    await pglite.exec(sql)
    const prisma = new PrismaClient({ adapter: new PrismaPGlite(pglite) })

    const book = await prisma.spikeBook.create({ data: { title: 'Dune Messiah' } })
    await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM spike_books WHERE id = ${book.id}::uuid FOR UPDATE`
      expect(locked).toHaveLength(1)
      await tx.spikeLoan.create({ data: { bookId: book.id } })
      await tx.spikeBook.update({ where: { id: book.id }, data: { status: 'borrowed' } })
    })
    await expect(prisma.spikeLoan.create({ data: { bookId: book.id } })).rejects.toThrow()

    // Rollback on error
    await expect(prisma.$transaction(async (tx) => {
      await tx.spikeBook.update({ where: { id: book.id }, data: { status: 'archived' } })
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect((await prisma.spikeBook.findUniqueOrThrow({ where: { id: book.id } })).status).toBe('borrowed')

    const similar = await prisma.$queryRaw<{ title: string }[]>`SELECT title FROM spike_books WHERE similarity(title, ${'dune mesiah'}) > 0.3`
    expect(similar.map(r => r.title)).toEqual(['Dune Messiah'])
    await prisma.$disconnect()
  })
})
