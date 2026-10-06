import type { IMemberDto } from '../../../shared/contracts/Libraries'
import type { Permission } from '../../../shared/permissions'
import type { IMembership } from '../auth/Access'
import type { PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PERMISSIONS } from '../../../shared/permissions'
import { DomainError, notFound } from '../common/DomainError'
import { toEnumPermission, toPermission } from '../common/PermissionMap'
import { requireOwner } from '../libraries/LibrariesService'
import { InjectPrisma } from '../prisma/Prisma'

/** Permissions a non-owner changes (adds or removes) must all be ones they hold: no escalation, no stripping others' rights. */
export function changedPermissions(before: Permission[], after: Permission[]): Permission[] {
  return [...after.filter(p => !before.includes(p)), ...before.filter(p => !after.includes(p))]
}

@Injectable()
export class MembersService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async list(libraryId: string): Promise<IMemberDto[]> {
    const rows = await this.prisma.libraryMember.findMany({ where: { libraryId }, include: { user: { select: { name: true } } } })
    return rows
      .map(r => ({
        userId: r.userId,
        displayName: r.user.name || 'Member',
        role: r.role,
        permissions: r.permissions.map(toPermission),
        joinedAt: r.createdAt.toISOString(),
      }))
      .sort((a, b) => (a.role === b.role ? a.displayName.localeCompare(b.displayName) : a.role === 'owner' ? -1 : 1))
  }

  async setPermissions(actor: IMembership, userId: string, permissions: Permission[]): Promise<void> {
    const target = await this.target(actor.libraryId, userId)
    if (target.role === 'owner') {
      throw new DomainError(409, 'owner_has_all', 'Owners always have every permission')
    }
    const next = [...new Set(permissions)].sort()
    if (actor.role !== 'owner') {
      const outside = changedPermissions(target.permissions.map(toPermission), next).filter(p => !actor.permissions.includes(p))
      if (outside.length) {
        throw new DomainError(403, 'forbidden', 'You can only change permissions you have yourself', { permission: outside[0] })
      }
    }
    await this.prisma.libraryMember.update({
      where: { libraryId_userId: { libraryId: actor.libraryId, userId } },
      data: { permissions: next.map(toEnumPermission) },
    })
  }

  /** Anyone may leave; removing someone else needs members.manage, and only owners remove owners. */
  async remove(actor: IMembership, userId: string): Promise<void> {
    const target = await this.target(actor.libraryId, userId)
    if (userId !== actor.userId) {
      if (!actor.permissions.includes('members.manage')) {
        throw new DomainError(403, 'forbidden', 'You don\'t have permission to do this', { permission: 'members.manage' })
      }
      if (target.role === 'owner' && actor.role !== 'owner') {
        throw new DomainError(403, 'owner_only', 'Only owners can remove an owner')
      }
    }
    if (target.role === 'owner' && await this.ownerCount(actor.libraryId) === 1) {
      throw new DomainError(409, 'last_owner', 'A library needs at least one owner. Make someone else an owner first, or delete the library.')
    }
    await this.prisma.libraryMember.delete({ where: { libraryId_userId: { libraryId: actor.libraryId, userId } } })
  }

  /** Promote to owner, or demote an owner to a member who keeps every permission. */
  async setOwner(actor: IMembership, userId: string, owner: boolean): Promise<void> {
    requireOwner(actor)
    const target = await this.target(actor.libraryId, userId)
    if (!owner && target.role === 'owner' && await this.ownerCount(actor.libraryId) === 1) {
      throw new DomainError(409, 'last_owner', 'A library needs at least one owner')
    }
    await this.prisma.libraryMember.update({
      where: { libraryId_userId: { libraryId: actor.libraryId, userId } },
      data: owner ? { role: 'owner', permissions: [] } : { role: 'member', permissions: PERMISSIONS.map(toEnumPermission) },
    })
  }

  private async target(libraryId: string, userId: string) {
    const target = await this.prisma.libraryMember.findUnique({ where: { libraryId_userId: { libraryId, userId } } })
    if (!target) {
      throw notFound('Member')
    }
    return target
  }

  private ownerCount(libraryId: string): Promise<number> {
    return this.prisma.libraryMember.count({ where: { libraryId, role: 'owner' } })
  }
}
