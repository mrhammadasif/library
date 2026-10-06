import { z } from 'zod'
import { IdSchema } from './Common.ts'

export const BookStatusSchema = z.enum(['on_shelf', 'borrowed', 'missing', 'archived'])
export const ColorNameSchema = z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'grey', 'multi'])
export const ArchiveReasonSchema = z.enum(['donated', 'lost', 'discarded', 'other'])

const text = (max: number) => z.string().trim().max(max).transform(v => v || null).nullable()
const list = (max: number, len: number) => z.array(z.string().trim().min(1).max(len)).max(max)

/** Editable fields of a book (add and edit forms). Blank strings become null. */
export const BookFieldsInput = z.object({
  isbn13: z.string().regex(/^97[89]\d{10}$/, 'ISBN-13 must be 13 digits starting 978/979').nullable(),
  isbn10: z.string().regex(/^\d{9}[\dX]$/).nullable(),
  title: z.string().trim().min(1).max(500),
  subtitle: text(500),
  authors: list(20, 200),
  publisher: text(200),
  publishedYear: z.number().int().min(0).max(2200).nullable(),
  pages: z.number().int().positive().nullable(),
  language: text(10),
  description: text(5000),
  categories: list(20, 60),
  tags: list(30, 40).transform(tags => [...new Set(tags.map(t => t.toLowerCase()))]),
  coverPath: z.string().max(300).nullable(),
  coverUrl: z.url().max(1000).nullable(),
  dominantColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  colorName: ColorNameSchema.nullable(),
  condition: text(200),
  notes: text(2000),
})
export type IBookFieldsInput = z.input<typeof BookFieldsInput>

export const BookSchema = z.object({
  id: IdSchema,
  libraryId: IdSchema,
  isbn13: z.string().nullable(),
  isbn10: z.string().nullable(),
  title: z.string(),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  publisher: z.string().nullable(),
  publishedYear: z.number().nullable(),
  pages: z.number().nullable(),
  language: z.string().nullable(),
  description: z.string().nullable(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  coverPath: z.string().nullable(),
  coverUrl: z.string().nullable(),
  dominantColor: z.string().nullable(),
  colorName: ColorNameSchema.nullable(),
  condition: z.string().nullable(),
  notes: z.string().nullable(),
  status: BookStatusSchema,
  shelfId: IdSchema.nullable(),
  archivedAt: z.iso.datetime().nullable(),
  archiveReason: z.string().nullable(),
  donatedTo: z.string().nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
})
export type IBookDto = z.infer<typeof BookSchema>

export const BookEventSchema = z.object({
  id: z.string(),
  type: z.enum(['created', 'moved', 'lent', 'returned', 'archived', 'restored', 'audited', 'marked_missing']),
  fromShelfId: IdSchema.nullable(),
  toShelfId: IdSchema.nullable(),
  payload: z.record(z.string(), z.unknown()),
  actorName: z.string().nullable(),
  at: z.iso.datetime(),
})
export type IBookEventDto = z.infer<typeof BookEventSchema>

export const ListBooksQuery = z.object({
  shelfId: IdSchema.optional(),
  status: BookStatusSchema.optional(),
  isbn: z.string().regex(/^\d{13}$/).optional(),
  order: z.enum(['title', 'recent', 'archived']).default('title'),
  limit: z.coerce.number().int().min(1).max(5000).default(2000),
})

/** `id` lets the app upload the cover to {library}/{id}-… before the book exists. */
export const AddBookInput = z.object({ id: IdSchema.optional(), shelfId: IdSchema, book: BookFieldsInput })
export const MoveBooksInput = z.object({ bookIds: z.array(IdSchema).min(1).max(500), shelfId: IdSchema })
export const ArchiveBooksInput = z.object({
  bookIds: z.array(IdSchema).min(1).max(500),
  reason: ArchiveReasonSchema.default('donated'),
  recipient: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
})
export const ShelfTargetInput = z.object({ shelfId: IdSchema })
export const OptionalShelfInput = z.object({ shelfId: IdSchema.nullable().optional() })
export const CountSchema = z.object({ count: z.number().int() })
