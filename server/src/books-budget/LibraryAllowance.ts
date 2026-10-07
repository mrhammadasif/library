import type { IAppConfig } from '../config/AppConfig'
import type { PrismaClient } from '../generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG } from '../config/AppConfig'
import { InjectPrisma } from '../prisma/Prisma'
import { pacificDay } from './PacificDay'

export type AllowanceKind = 'google_books' | 'web_search'

/** What a caller knows about the library: trusted (Home AI allowed by the admin) libraries have no daily allowance. */
export interface IAllowanceScope {
  id: string
  homeAiAllowed: boolean
}

/**
 * Per-library daily allowances for services the server pays for or runs from the home connection: Google Books calls
 * (`LIBRARY_DAILY_GOOGLE_BOOKS`) and SearXNG web searches (`LIBRARY_DAILY_WEB_SEARCHES`). One atomic statement per
 * request, like the server-wide Google budget. When spent, callers degrade (Open Library only / AI without web results);
 * nothing is refused.
 */
@Injectable()
export class LibraryAllowance {
  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    @Inject(APP_CONFIG) private readonly config: IAppConfig,
  ) {}

  async take(scope: IAllowanceScope, kind: AllowanceKind, now = new Date()): Promise<boolean> {
    if (scope.homeAiAllowed) {
      return true
    }
    const limit = kind === 'google_books' ? this.config.LIBRARY_DAILY_GOOGLE_BOOKS : this.config.LIBRARY_DAILY_WEB_SEARCHES
    if (limit <= 0) {
      return false
    }
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO library_daily_usage (library_id, day, kind, count) VALUES (${scope.id}::uuid, ${pacificDay(now)}::date, ${kind}, 1)
      ON CONFLICT (library_id, day, kind) DO UPDATE SET count = library_daily_usage.count + 1
      WHERE library_daily_usage.count < ${limit}
      RETURNING count`
    return rows.length > 0
  }
}
