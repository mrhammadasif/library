import { z } from 'zod'
import { PERMISSIONS } from '../permissions.ts'

export const IdSchema = z.uuid()
export const PermissionSchema = z.enum(PERMISSIONS)
export const AiProviderSchema = z.enum(['openai', 'gemini', 'openai_compatible'])
export const RoleSchema = z.enum(['owner', 'member'])

/** Every error the API returns has this shape; 403s for missing permissions also carry `permission`. */
export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  message: z.string(),
  permission: PermissionSchema.optional(),
})
export type IApiErrorBody = z.infer<typeof ApiErrorSchema>

export const OkSchema = z.object({ ok: z.literal(true) })
