import { Inject } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { migratePglite } from './LocalDb'

export const PRISMA = Symbol('PRISMA')

/** Injects the shared PrismaClient (Postgres in production, PGlite locally and in tests). */
export const InjectPrisma = () => Inject(PRISMA)

/**
 * `postgresql://…` → Postgres (production). `pglite:./dir` → an on-disk PGlite database for local development on a
 * machine without Docker; migrations apply on boot. PGlite packages are dev dependencies, imported only in that mode.
 */
export async function createPrismaClient(databaseUrl: string): Promise<PrismaClient> {
  if (databaseUrl.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite')
    const { pg_trgm } = await import('@electric-sql/pglite/contrib/pg_trgm')
    const { PrismaPGlite } = await import('pglite-prisma-adapter')
    const pglite = await PGlite.create({ dataDir: databaseUrl.slice('pglite:'.length), extensions: { pg_trgm } })
    await migratePglite(pglite)
    return new PrismaClient({ adapter: new PrismaPGlite(pglite) })
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
}

export type { PrismaClient }
