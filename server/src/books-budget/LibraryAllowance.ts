import type { IAppConfig } from '../config/AppConfig'
import type { PrismaClient } from '../generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { APP_CONFIG } from '../config/AppConfig'
import { InjectPrisma } from '../prisma/Prisma'
import { pacificDay } from './PacificDay'

export type AllowanceKind = 'google_books' | 'web_search' | 'ai'

/** What a caller knows about the library: libraries the admin marked trusted have no daily allowance. */
export interface IAllowanceScope {
  id: string
  trusted: boolean
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
    if (scope.trusted) {
      return true
    }
    const limit = kind === 'google_books' ? this.config.LIBRARY_DAILY_GOOGLE_BOOKS : this.config.LIBRARY_DAILY_WEB_SEARCHES
    return this.takeUpTo(scope.id, kind, limit, now)
  }

  /** One unit of today's `kind` for the library, if fewer than `limit` were used. Atomic across requests and containers. */
  async takeUpTo(libraryId: string, kind: AllowanceKind, limit: number, now = new Date()): Promise<boolean> {
    if (limit <= 0) {
      return false
    }
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO library_daily_usage (library_id, day, kind, count) VALUES (${libraryId}::uuid, ${pacificDay(now)}::date, ${kind}, 1)
      ON CONFLICT (library_id, day, kind) DO UPDATE SET count = library_daily_usage.count + 1
      WHERE library_daily_usage.count < ${limit}
      RETURNING count`
    return rows.length > 0
  }

  async usedToday(libraryId: string, kind: AllowanceKind, now = new Date()): Promise<number> {
    const row = await this.prisma.libraryDailyUsage.findUnique({
      where: { libraryId_day_kind: { libraryId, day: new Date(`${pacificDay(now)}T00:00:00Z`), kind } },
    })
    return row?.count ?? 0
  }
}
