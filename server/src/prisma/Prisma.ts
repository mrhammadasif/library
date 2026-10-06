import { Inject } from '@nestjs/common'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

export const PRISMA = Symbol('PRISMA')

/** Injects the shared PrismaClient (Postgres in production, PGlite in tests). */
export const InjectPrisma = () => Inject(PRISMA)

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
}

export type { PrismaClient }
