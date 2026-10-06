import type { IBookDto } from '../../../shared/contracts/Books'
import type { Book } from '../generated/prisma/client'

const iso = (d: Date | null) => d?.toISOString() ?? null

export function toBookDto(b: Book): IBookDto {
  return {
    id: b.id,
    libraryId: b.libraryId,
    isbn13: b.isbn13,
    isbn10: b.isbn10,
    title: b.title,
    subtitle: b.subtitle,
    authors: b.authors,
    publisher: b.publisher,
    publishedYear: b.publishedYear,
    pages: b.pages,
    language: b.language,
    description: b.description,
    categories: b.categories,
    tags: b.tags,
    coverPath: b.coverPath,
    coverUrl: b.coverUrl,
    dominantColor: b.dominantColor,
    colorName: b.colorName,
    condition: b.condition,
    notes: b.notes,
    status: b.status,
    shelfId: b.shelfId,
    archivedAt: iso(b.archivedAt),
    archiveReason: b.archiveReason,
    donatedTo: b.donatedTo,
    lastSeenAt: iso(b.lastSeenAt),
    createdAt: b.createdAt.toISOString(),
  }
}
