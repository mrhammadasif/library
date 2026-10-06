import { z } from 'zod'
import { IdSchema } from './Common.ts'

export const AuditModeSchema = z.enum(['random', 'shelf'])
export const AuditResultSchema = z.enum(['pending', 'found', 'missing', 'misplaced', 'unexpected'])

export const AuditSchema = z.object({
  id: IdSchema,
  mode: AuditModeSchema,
  shelfId: IdSchema.nullable(),
  sampleSize: z.number().int().nullable(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  counts: z.record(AuditResultSchema, z.number().int()),
})
export type IAuditDto = z.infer<typeof AuditSchema>

export const AuditItemSchema = z.object({
  id: IdSchema,
  bookId: IdSchema.nullable(),
  bookTitle: z.string().nullable(),
  bookAuthors: z.array(z.string()),
  coverPath: z.string().nullable(),
  coverUrl: z.string().nullable(),
  dominantColor: z.string().nullable(),
  expectedShelfId: IdSchema.nullable(),
  foundShelfId: IdSchema.nullable(),
  scannedIsbn: z.string().nullable(),
  result: AuditResultSchema,
})
export type IAuditItemDto = z.infer<typeof AuditItemSchema>

export const AuditDetailSchema = z.object({ audit: AuditSchema, items: z.array(AuditItemSchema) })

export const StartAuditInput = z.object({
  mode: AuditModeSchema,
  size: z.number().int().min(1).max(200).default(10),
  shelfId: IdSchema.optional(),
}).refine(v => v.mode === 'random' || v.shelfId, { message: 'Choose a shelf to check', path: ['shelfId'] })

export const RecordAuditItemInput = z.object({
  result: z.enum(['found', 'missing', 'misplaced', 'pending']),
  foundShelfId: IdSchema.nullable().optional(),
  move: z.boolean().default(false),
})

export const AuditScanInput = z.object({ isbn: z.string().regex(/^\d{13}$/).optional(), bookId: IdSchema.optional() })
  .refine(v => v.isbn || v.bookId, { message: 'Scan a book' })

export const AuditScanResultSchema = z.object({
  itemId: IdSchema,
  bookId: IdSchema.nullable(),
  result: AuditResultSchema,
  already: z.boolean(),
})
