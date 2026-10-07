import type { ILookupResultDto } from '../../../shared/contracts/Lookup'
import type { PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { normalizeIsbn } from '../../../shared/isbn'
import { fetchGoogleByIsbn, fetchOpenLibraryByIsbn, mergeDrafts, searchCandidates } from '../../../shared/metadata'
import { DomainError } from '../common/DomainError'
import { GoogleBooksBudget } from '../books-budget/GoogleBooksBudget'
import { InjectPrisma } from '../prisma/Prisma'

/** ISBN → Open Library + Google Books merged into one draft; title/author → candidates. No AI here, so it's fast. */
@Injectable()
export class LookupService {
  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    private readonly googleBooks: GoogleBooksBudget,
  ) {}

  async lookup(libraryId: string, input: { isbn?: string, title?: string, author?: string }): Promise<ILookupResultDto> {
    if (input.isbn) {
      const isbn = normalizeIsbn(input.isbn)
      if (!isbn) {
        throw new DomainError(400, 'invalid_isbn', 'That doesn\'t look like a valid ISBN')
      }
      const [openLibrary, google] = await Promise.allSettled([
        fetchOpenLibraryByIsbn(isbn.isbn13),
        fetchGoogleByIsbn(isbn.isbn13, this.googleBooks.access()),
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
    const candidates = await searchCandidates(input.title!, input.author ?? null, this.googleBooks.access())
    return { draft: null, candidates, sources: { openLibrary: false, googleBooks: false }, isbn: null, existingCopies: [] }
  }
}
