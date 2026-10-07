import type { IMembershipDto } from '../../../shared/contracts/Libraries'
import type { IMembership } from '../auth/Access'
import type { PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { PERMISSIONS } from '../../../shared/permissions'
import { DomainError } from '../common/DomainError'
import { toPermission } from '../common/PermissionMap'
import { InjectPrisma } from '../prisma/Prisma'

export function requireOwner(membership: IMembership): void {
  if (membership.role !== 'owner') {
    throw new DomainError(403, 'owner_only', 'Only an owner can do this')
  }
}

@Injectable()
export class LibrariesService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async listMine(userId: string): Promise<IMembershipDto[]> {
    const rows = await this.prisma.libraryMember.findMany({
      where: { userId },
      include: { library: true },
      orderBy: { library: { name: 'asc' } },
    })
    return rows.map(r => ({
      library: {
        id: r.library.id,
        name: r.library.name,
        enrichProvider: r.library.enrichProvider,
        visionProvider: r.library.visionProvider,
        trusted: r.library.trusted,
        aiDailyLimit: r.library.aiDailyLimit,
      },
      role: r.role,
      permissions: r.role === 'owner' ? [...PERMISSIONS] : r.permissions.map(toPermission),
    }))
  }

  async create(userId: string, name: string): Promise<{ id: string }> {
    const library = await this.prisma.library.create({
      data: { name, createdBy: userId, members: { create: { userId, role: 'owner' } } },
      select: { id: true },
    })
    return library
  }

  async rename(membership: IMembership, name: string): Promise<void> {
    requireOwner(membership)
    await this.prisma.library.update({ where: { id: membership.libraryId }, data: { name } })
  }

  /** Deletes the library and everything in it, for every member. */
  /** Deletes the library and everything in it (FK cascades). The owner must type its exact name back. */
  async remove(membership: IMembership, confirmName: string): Promise<void> {
    requireOwner(membership)
    const library = await this.prisma.library.findUniqueOrThrow({ where: { id: membership.libraryId }, select: { name: true } })
    if (confirmName.trim() !== library.name.trim()) {
      throw new DomainError(400, 'name_mismatch', 'Type the library\'s name exactly to delete it')
    }
    await this.prisma.library.delete({ where: { id: membership.libraryId } })
  }

  async setTrusted(libraryId: string, trusted: boolean): Promise<void> {
    await this.prisma.library.update({ where: { id: libraryId }, data: { trusted } })
  }
}
