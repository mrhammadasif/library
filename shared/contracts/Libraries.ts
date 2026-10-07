import { z } from 'zod'
import { AiProviderSchema, IdSchema, PermissionSchema, RoleSchema } from './Common.ts'

export const LibrarySchema = z.object({
  id: IdSchema,
  name: z.string(),
  enrichProvider: AiProviderSchema.nullable(),
  visionProvider: AiProviderSchema.nullable(),
  /** Set by the server admin: no daily allowances. */
  trusted: z.boolean(),
  /** AI requests per day this library allows itself (null = no limit). */
  aiDailyLimit: z.number().int().nullable(),
})

export const MembershipSchema = z.object({
  library: LibrarySchema,
  role: RoleSchema,
  /** Effective permissions: every permission for owners. */
  permissions: z.array(PermissionSchema),
})
export type IMembershipDto = z.infer<typeof MembershipSchema>

export const LibraryNameInput = z.object({ name: z.string().trim().min(1).max(80) })
export const TrustedInput = z.object({ trusted: z.boolean() })
/** Deleting a library needs its exact name typed back (the app's confirmation page; enforced here too). */
export const DeleteLibraryInput = z.object({ confirmName: z.string().max(200) })

export const MemberSchema = z.object({
  userId: IdSchema,
  displayName: z.string(),
  role: RoleSchema,
  permissions: z.array(PermissionSchema),
  joinedAt: z.iso.datetime(),
})
export type IMemberDto = z.infer<typeof MemberSchema>

export const SetPermissionsInput = z.object({ permissions: z.array(PermissionSchema).max(10) })
export const SetOwnerInput = z.object({ owner: z.boolean() })

export const InviteSchema = z.object({
  id: IdSchema,
  code: z.string(),
  permissions: z.array(PermissionSchema),
  expiresAt: z.iso.datetime(),
  maxUses: z.number().int(),
  uses: z.number().int(),
})
export type IInviteDto = z.infer<typeof InviteSchema>

export const CreateInviteInput = z.object({
  permissions: z.array(PermissionSchema).max(10),
  days: z.number().int().min(1).max(90).default(7),
  maxUses: z.number().int().min(1).max(100).default(1),
})

export const AcceptInviteInput = z.object({ code: z.string().trim().min(4).max(32) })
