import { z } from 'zod'
import { AiProviderSchema } from './Common.ts'
import { BookDraftSchema } from './Lookup.ts'

export const AiProviderConfigSchema = z.object({
  provider: AiProviderSchema,
  model: z.string(),
  baseUrl: z.string().nullable(),
  supportsVision: z.boolean(),
  hasKey: z.boolean(),
})
export type IAiProviderConfigDto = z.infer<typeof AiProviderConfigSchema>

/** apiKey blank keeps the stored key (e.g. only changing the model). */
export const SetAiProviderInput = z.object({
  model: z.string().trim().min(1).max(200),
  baseUrl: z.url().max(500).nullable().optional(),
  apiKey: z.string().trim().max(500).nullable().optional(),
  supportsVision: z.boolean().default(false),
})

export const AiUsageInput = z.object({ enrich: AiProviderSchema.nullable(), vision: AiProviderSchema.nullable() })

/** The library's own daily cap on AI requests (its key, its bill). null = no limit. */
export const AiLimitInput = z.object({ dailyLimit: z.number().int().min(1).max(10_000).nullable() })
export const AiLimitSchema = z.object({
  dailyLimit: z.number().int().nullable(),
  usedToday: z.number().int(),
  /** The server's free tier for libraries without their own key; null = none. */
  free: z.object({ perDay: z.number().int(), usedToday: z.number().int() }).nullable(),
})
export type IAiLimitDto = z.infer<typeof AiLimitSchema>

export const EnrichInput = z.object({ draft: BookDraftSchema })
export const EnrichmentSchema = z.object({
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  description: z.string().nullable(),
  language: z.string().nullable(),
  // Filled from web search results when the book databases had nothing (ISBN only if printed in a result).
  isbn13: z.string().nullable(),
  publisher: z.string().nullable(),
  publishedYear: z.number().int().nullable(),
  pages: z.number().int().nullable(),
})
export const EnrichResultSchema = z.object({ enrichment: EnrichmentSchema, provider: z.string() })

/** A ≤768px JPEG, base64 (~100–200 KB). */
export const IdentifyCoverInput = z.object({ imageBase64: z.string().min(100).max(4_000_000) })
export const IdentificationSchema = z.object({
  title: z.string(),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  isbn: z.string().nullable(),
  publisher: z.string().nullable(),
  confidence: z.number(),
})
export const IdentifyResultSchema = z.object({ identification: IdentificationSchema, candidates: z.array(BookDraftSchema) })
