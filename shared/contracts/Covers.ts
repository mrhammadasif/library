import { z } from 'zod'
import { IdSchema } from './Common.ts'

export const PresignCoverInput = z.object({ bookId: IdSchema })
/** PUT the JPEG to uploadUrl (Content-Type: image/jpeg), then save `key` as the book's coverPath. */
export const PresignCoverResultSchema = z.object({ uploadUrl: z.url(), key: z.string(), publicUrl: z.url() })
