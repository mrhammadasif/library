import type { ExecutionContext } from '@nestjs/common'
import type { Permission } from '../../../shared/permissions'
import type { LibraryRole } from '../generated/prisma/client'
import { createParamDecorator, SetMetadata } from '@nestjs/common'

export const LIBRARY_ACCESS = 'library-access'
export const ALLOW_UNVERIFIED = 'allow-unverified'

/** Route needs a member of `:libraryId`; with a permission, that permission too (owners hold all). */
export const RequireLibrary = (permission?: Permission) => SetMetadata(LIBRARY_ACCESS, { permission: permission ?? null })

/** Lets an unverified (read-only) user call a write route, e.g. account clean-up. */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED, true)

export interface IMembership {
  libraryId: string
  userId: string
  role: LibraryRole
  /** Effective permissions (every permission for owners). */
  permissions: Permission[]
}

/** The caller's membership, attached by AccessGuard on @RequireLibrary routes. */
export const Membership = createParamDecorator((_data: unknown, ctx: ExecutionContext): IMembership =>
  ctx.switchToHttp().getRequest().membership)

/** The signed-in user's id. */
export const UserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string =>
  ctx.switchToHttp().getRequest().user.id)
