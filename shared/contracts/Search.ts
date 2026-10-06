import { z } from 'zod'
import { BookStatusSchema, ColorNameSchema } from './Books.ts'
import { IdSchema } from './Common.ts'

const csv = z.string().transform(v => v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))

export const SearchBooksQuery = z.object({
  q: z.string().trim().max(200).optional(),
  tags: csv.optional(),
  color: ColorNameSchema.optional(),
  status: BookStatusSchema.optional(),
  shelfId: IdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(40),
  offset: z.coerce.number().int().min(0).default(0),
})

export const TagCountSchema = z.object({ tag: z.string(), books: z.number().int() })

const Named = z.object({ name: z.string(), books: z.number().int() })

/** Everything the Stats screen shows, in one call. */
export const LibraryStatsSchema = z.object({
  total: z.number().int(),
  archived: z.number().int(),
  byStatus: z.record(BookStatusSchema, z.number().int()),
  pages: z.number().int(),
  authors: z.number().int(),
  racks: z.array(z.object({ id: IdSchema, name: z.string(), books: z.number().int(), shelves: z.array(z.object({ id: IdSchema, name: z.string(), books: z.number().int() })) })),
  topAuthors: z.array(Named),
  topCategories: z.array(Named),
  topTags: z.array(Named),
  colors: z.array(z.object({ color: ColorNameSchema, books: z.number().int() })),
  languages: z.array(Named),
  decades: z.array(z.object({ decade: z.number().int(), books: z.number().int() })),
  addedByMonth: z.array(z.object({ month: z.string(), books: z.number().int() })),
  loans: z.object({ open: z.number().int(), overdue: z.number().int(), total: z.number().int() }),
  audit: z.object({
    last: z.object({ id: IdSchema, completedAt: z.iso.datetime(), mode: z.string(), found: z.number().int(), missing: z.number().int(), total: z.number().int() }).nullable(),
    unseenYear: z.number().int(),
  }),
})
export type ILibraryStatsDto = z.infer<typeof LibraryStatsSchema>
