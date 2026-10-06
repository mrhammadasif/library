// TEST DATA ONLY. In-process database for e2e tests: PGlite by default, or real Postgres when TEST_DATABASE_URL is set
// (the pre-deploy run on the home server).
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { PrismaPg } from '@prisma/adapter-pg'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaPGlite } from 'pglite-prisma-adapter'
import { PrismaClient } from '../../src/generated/prisma/client'

const MIGRATIONS = join(__dirname, '../../prisma/migrations')

export interface ITestDb {
  prisma: PrismaClient
  /** Empties every table between tests. */
  reset: () => Promise<void>
  close: () => Promise<void>
}

function migrationSql(): string[] {
  return readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
    .map(name => readFileSync(join(MIGRATIONS, name, 'migration.sql'), 'utf8'))
}

async function truncateAll(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(t => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`)
  }
}

export async function createTestDb(): Promise<ITestDb> {
  const url = process.env.TEST_DATABASE_URL
  if (url) {
    // Real Postgres: migrations are applied beforehand with `prisma migrate deploy`.
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
    return { prisma, reset: () => truncateAll(prisma), close: () => prisma.$disconnect() }
  }
  const pglite = await PGlite.create({ extensions: { pg_trgm } })
  for (const sql of migrationSql()) {
    await pglite.exec(sql)
  }
  const prisma = new PrismaClient({ adapter: new PrismaPGlite(pglite) })
  return { prisma, reset: () => truncateAll(prisma), close: async () => { await prisma.$disconnect(); await pglite.close() } }
}
