import { z } from 'zod'
import { IdSchema } from './Common.ts'

export const LoanSchema = z.object({
  id: IdSchema,
  bookId: IdSchema,
  bookTitle: z.string(),
  borrowerUserId: IdSchema.nullable(),
  borrowerName: z.string(),
  borrowerContact: z.string().nullable(),
  notes: z.string().nullable(),
  lentAt: z.iso.datetime(),
  dueAt: z.iso.datetime().nullable(),
  returnedAt: z.iso.datetime().nullable(),
})
export type ILoanDto = z.infer<typeof LoanSchema>

export const ListLoansQuery = z.object({ open: z.stringbool().optional(), bookId: IdSchema.optional() })

/** A member (borrowerUserId) or anyone by name. */
export const LendInput = z.object({
  borrowerUserId: IdSchema.nullable().optional(),
  borrowerName: z.string().trim().max(120).nullable().optional(),
  contact: z.string().trim().max(120).nullable().optional(),
  dueAt: z.iso.datetime({ offset: true }).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
}).refine(v => v.borrowerUserId || v.borrowerName, { message: 'Who is borrowing the book?', path: ['borrowerName'] })
