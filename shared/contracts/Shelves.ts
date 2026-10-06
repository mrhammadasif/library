import { z } from 'zod'
import { IdSchema } from './Common.ts'

const Name = z.string().trim().min(1).max(60)
const Notes = z.string().trim().max(500).nullable()

export const ShelfSchema = z.object({
  id: IdSchema,
  rackId: IdSchema,
  name: z.string(),
  notes: z.string().nullable(),
  position: z.number().int(),
  /** Books whose home is this shelf (on it, lent out or missing). */
  bookCount: z.number().int(),
})

export const RackSchema = z.object({
  id: IdSchema,
  name: z.string(),
  notes: z.string().nullable(),
  position: z.number().int(),
  shelves: z.array(ShelfSchema),
})
export type IRackDto = z.infer<typeof RackSchema>

export const CreateRackInput = z.object({ name: Name, notes: Notes.optional() })
export const UpdateRackInput = z.object({ name: Name.optional(), notes: Notes.optional() })
export const CreateShelfInput = z.object({ name: Name, notes: Notes.optional() })
export const UpdateShelfInput = z.object({ name: Name.optional(), notes: Notes.optional(), rackId: IdSchema.optional() })
export const OrderInput = z.object({ ids: z.array(IdSchema).min(1).max(500) })
export const CreatedSchema = z.object({ id: IdSchema })
