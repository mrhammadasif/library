import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import type { Permission } from '../../../shared/permissions'
import type { PrismaClient } from '../generated/prisma/client'
import type { IMembership } from './Access'
import type { Auth } from './CreateAuth'
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { fromNodeHeaders } from 'better-auth/node'
import { PERMISSIONS } from '../../../shared/permissions'
import { DomainError } from '../common/DomainError'
import { toPermission } from '../common/PermissionMap'
import { InjectPrisma } from '../prisma/Prisma'
import { ALLOW_UNVERIFIED, LIBRARY_ACCESS } from './Access'

export const AUTH = Symbol('AUTH')

const READS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * The single global guard, in a fixed order:
 * session → public/optional routes → 401 → unverified users are read-only → library membership (404) → permission (403).
 * Honours better-auth's @AllowAnonymous / @OptionalAuth metadata and fills request.session for its @Session decorator.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    @InjectPrisma() private readonly prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>()
    const targets = [context.getHandler(), context.getClass()]
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
    request.session = session
    request.user = session?.user ?? null

    if (this.reflector.getAllAndOverride<boolean>('PUBLIC', targets)) {
      return true
    }
    if (!session) {
      if (this.reflector.getAllAndOverride<boolean>('OPTIONAL', targets)) {
        return true
      }
      throw new UnauthorizedException({ code: 'unauthorized', message: 'Sign in first' })
    }

    if (!READS.has(request.method) && !session.user.emailVerified && !this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED, targets)) {
      throw new ForbiddenException({ code: 'email_unverified', message: 'Verify your email to do this' })
    }

    const access = this.reflector.getAllAndOverride<{ permission: Permission | null }>(LIBRARY_ACCESS, targets)
    if (access) {
      request.membership = await this.membership(String(request.params.libraryId ?? ''), session.user.id, access.permission)
    }
    return true
  }

  private async membership(libraryId: string, userId: string, permission: Permission | null): Promise<IMembership> {
    const row = /^[0-9a-f-]{36}$/i.test(libraryId)
      ? await this.prisma.libraryMember.findUnique({ where: { libraryId_userId: { libraryId, userId } } })
      : null
    // Not a member looks exactly like "no such library": other people's libraries stay invisible.
    if (!row) {
      throw new DomainError(404, 'not_found', 'Library not found')
    }
    const permissions = row.role === 'owner' ? [...PERMISSIONS] : row.permissions.map(toPermission)
    if (permission && !permissions.includes(permission)) {
      throw new DomainError(403, 'forbidden', 'You don\'t have permission to do this', { permission })
    }
    return { libraryId, userId, role: row.role, permissions }
  }
}
