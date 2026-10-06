import type { z } from 'zod'
import type { EnrichmentSchema, IdentificationSchema } from '~shared/contracts/Ai'

export type { IBookDraft } from '~shared/metadata'
export type IEnrichment = z.infer<typeof EnrichmentSchema>
export type IIdentification = z.infer<typeof IdentificationSchema>
