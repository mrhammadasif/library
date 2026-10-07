import type { IGoogleBooks } from '../../../shared/metadata'
import type { IAppConfig } from '../config/AppConfig'
import type { PrismaClient } from '../generated/prisma/client'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { APP_CONFIG } from '../config/AppConfig'
import { InjectPrisma } from '../prisma/Prisma'

/** Google's Books quota resets at midnight Pacific time, so the budget counts Pacific days ("2026-10-07"). */
export function pacificDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * Server-wide daily cap on Google Books requests (default 900, under the key's 1,000/day). The counter lives in
 * Postgres and is taken with one atomic statement, so restarts, parallel lookups or several containers can't exceed it.
 * When it's spent, lookups fall back to Open Library (and AI) until the next Pacific day.
 */
@Injectable()
export class GoogleBooksBudget {
  private readonly logger = new Logger('GoogleBooksBudget')
  private warnedDay: string | null = null

  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    @Inject(APP_CONFIG) private readonly config: IAppConfig,
  ) {}

  /** Reserves one request; false once today's budget is used up. */
  async take(now = new Date()): Promise<boolean> {
    const day = pacificDay(now)
    const limit = this.config.GOOGLE_BOOKS_DAILY_LIMIT
    if (limit <= 0) {
      return false
    }
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO google_books_usage (day, count) VALUES (${day}::date, 1)
      ON CONFLICT (day) DO UPDATE SET count = google_books_usage.count + 1
      WHERE google_books_usage.count < ${limit}
      RETURNING count`
    if (rows.length) {
      return true
    }
    if (this.warnedDay !== day) {
      this.warnedDay = day
      this.logger.warn(`Google Books daily budget of ${limit} reached for ${day} (Pacific); using Open Library only until tomorrow`)
    }
    return false
  }

  /** Google access for the shared lookup code, or null when no key is configured. */
  access(): IGoogleBooks | null {
    const apiKey = this.config.GOOGLE_BOOKS_API_KEY
    return apiKey ? { apiKey, take: () => this.take() } : null
  }
}
