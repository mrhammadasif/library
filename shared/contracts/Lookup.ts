import { z } from 'zod'
import { IdSchema } from './Common.ts'

export const BookDraftSchema = z.object({
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
  coverUrl: z.string().nullable(),
})

export const LookupInput = z.object({
  isbn: z.string().trim().max(20).optional(),
  title: z.string().trim().max(300).optional(),
  author: z.string().trim().max(200).optional(),
}).refine(v => v.isbn || v.title, { message: 'Give an ISBN or a title' })

export const LookupResultSchema = z.object({
  draft: BookDraftSchema.nullable(),
  candidates: z.array(BookDraftSchema),
  sources: z.object({ openLibrary: z.boolean(), googleBooks: z.boolean() }),
  isbn: z.object({ isbn13: z.string(), isbn10: z.string().nullable() }).nullable(),
  existingCopies: z.array(z.object({ id: IdSchema, title: z.string(), status: z.string(), shelfId: IdSchema.nullable() })),
})
export type ILookupResultDto = z.infer<typeof LookupResultSchema>
