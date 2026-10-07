import type { ILookupResultDto } from '../../../shared/contracts/Lookup'
import type { IBookDraft } from '../../../shared/metadata'
import type { IAppConfig } from '../config/AppConfig'
import type { IAllowanceScope } from '../books-budget/LibraryAllowance'
import type { PrismaClient } from '../generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { isbn13To10, normalizeIsbn } from '../../../shared/isbn'
import { dedupeCandidates, emptyDraft, fetchGoogleByIsbn, fetchOpenLibraryByIsbn, mergeDrafts, searchCandidates } from '../../../shared/metadata'
import { bookQuery, isbnsInResults, relevantResults, searchWeb, titleScore } from '../../../shared/webSearch'
import { DomainError } from '../common/DomainError'
import { GoogleBooksBudget } from '../books-budget/GoogleBooksBudget'
import { LibraryAllowance } from '../books-budget/LibraryAllowance'
import { APP_CONFIG } from '../config/AppConfig'
import { InjectPrisma } from '../prisma/Prisma'

/**
 * ISBN → Open Library + Google Books merged into one draft; title/author → candidates, plus ISBNs found on the web
 * (SearXNG) when the databases have no match with an ISBN. No AI here: free for everyone, within daily allowances.
 */
@Injectable()
export class LookupService {
  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    private readonly googleBooks: GoogleBooksBudget,
    private readonly allowance: LibraryAllowance,
    @Inject(APP_CONFIG) private readonly config: IAppConfig,
  ) {}

  async lookup(libraryId: string, input: { isbn?: string, title?: string, author?: string }): Promise<ILookupResultDto> {
    const scope = await this.prisma.library.findUniqueOrThrow({ where: { id: libraryId }, select: { id: true, trusted: true } })
    if (!await this.allowance.take(scope, 'lookup')) {
      throw new DomainError(429, 'lookup_limit', `This library's ${this.config.LIBRARY_DAILY_LOOKUPS} online lookups for today are used up. Try again tomorrow.`)
    }
    if (input.isbn) {
      const isbn = normalizeIsbn(input.isbn)
      if (!isbn) {
        throw new DomainError(400, 'invalid_isbn', 'That doesn\'t look like a valid ISBN')
      }
      const [openLibrary, google] = await Promise.allSettled([
        fetchOpenLibraryByIsbn(isbn.isbn13),
        fetchGoogleByIsbn(isbn.isbn13, this.googleBooks.access(scope)),
      ])
      const ol = openLibrary.status === 'fulfilled' ? openLibrary.value : null
      const gb = google.status === 'fulfilled' ? google.value : null
      const merged = mergeDrafts(ol, gb)
      const existing = await this.prisma.book.findMany({
        where: { libraryId, isbn13: isbn.isbn13, status: { not: 'archived' } },
        select: { id: true, title: true, status: true, shelfId: true },
      })
      return {
        draft: merged ? { ...merged, isbn13: isbn.isbn13, isbn10: isbn.isbn10 } : null,
        candidates: [],
        sources: { openLibrary: ol !== null, googleBooks: gb !== null },
        isbn,
        existingCopies: existing,
      }
    }
    const found = await searchCandidates(input.title!, input.author ?? null, this.googleBooks.access(scope))
    const fromWeb = await this.webCandidates(scope, input.title!, input.author ?? null, found)
    const candidates = dedupeCandidates([...found, ...fromWeb]).slice(0, 8)
    return { draft: null, candidates, sources: { openLibrary: false, googleBooks: false }, isbn: null, existingCopies: [] }
  }

  /**
   * When no database result with an ISBN matches the title, search the web and turn the ISBNs printed in matching results
   * into candidates (filled from Open Library / Google Books when they know that ISBN).
   */
  private async webCandidates(scope: IAllowanceScope, title: string, author: string | null, found: IBookDraft[]): Promise<IBookDraft[]> {
    const matched = found.some(c => c.isbn13 && titleScore(title, `${c.title} ${c.subtitle ?? ''}`) >= 0.75)
    if (!this.config.SEARXNG_URL || matched || !await this.allowance.take(scope, 'web_search')) {
      return []
    }
    const draft = { ...emptyDraft(), title, authors: author ? [author] : [] }
    const web = relevantResults(draft, await searchWeb(this.config.SEARXNG_URL, bookQuery(draft), { apiKey: this.config.SEARXNG_API_KEY }))
    const isbns = [...isbnsInResults(web)].slice(0, 3)
    return Promise.all(isbns.map(async (isbn13) => {
      const [ol, gb] = await Promise.all([
        fetchOpenLibraryByIsbn(isbn13).catch(() => null),
        fetchGoogleByIsbn(isbn13, this.googleBooks.access(scope)).catch(() => null),
      ])
      // Unknown to both databases: still worth offering, it carries the ISBN the web printed.
      return { ...(mergeDrafts(ol, gb) ?? draft), isbn13, isbn10: isbn13To10(isbn13) }
    }))
  }
}
