import type { IInviteDto } from '../../../shared/contracts/Libraries'
import type { Permission } from '../../../shared/permissions'
import type { IMembership } from '../auth/Access'
import type { PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { randomInt } from 'node:crypto'
import { DomainError } from '../common/DomainError'
import { toEnumPermission, toPermission } from '../common/PermissionMap'
import { InjectPrisma } from '../prisma/Prisma'

// No look-alikes (0/O, 1/I/L) so codes survive being read out loud or typed by kids.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newInviteCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
}

/** "good-code" → "GOODCODE": case, spaces and dashes don't matter. */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

@Injectable()
export class InvitesService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  async listActive(libraryId: string): Promise<IInviteDto[]> {
    const rows = await this.prisma.libraryInvite.findMany({
      where: { libraryId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    return rows.filter(r => r.uses < r.maxUses).map(r => ({
      id: r.id,
      code: r.code,
      permissions: r.permissions.map(toPermission),
      expiresAt: r.expiresAt.toISOString(),
      maxUses: r.maxUses,
      uses: r.uses,
    }))
  }

  async create(actor: IMembership, input: { permissions: Permission[], days: number, maxUses: number }): Promise<{ code: string }> {
    const outside = input.permissions.filter(p => !actor.permissions.includes(p))
    if (outside.length) {
      throw new DomainError(403, 'forbidden', 'You can only grant permissions you have yourself', { permission: outside[0] })
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newInviteCode()
      if (await this.prisma.libraryInvite.findUnique({ where: { code } })) {
        continue
      }
      await this.prisma.libraryInvite.create({
        data: {
          libraryId: actor.libraryId,
          code,
          permissions: [...new Set(input.permissions)].map(toEnumPermission),
          expiresAt: new Date(Date.now() + input.days * 86_400_000),
          maxUses: input.maxUses,
          createdBy: actor.userId,
        },
      })
      return { code }
    }
    throw new Error('Could not generate a unique invite code')
  }

  async revoke(libraryId: string, inviteId: string): Promise<void> {
    await this.prisma.libraryInvite.deleteMany({ where: { id: inviteId, libraryId } })
  }

  /** Joins with the invite's permissions. Already a member: no use is consumed. Row-locked so max_uses holds under races. */
  async accept(userId: string, rawCode: string): Promise<{ libraryId: string }> {
    const code = normalizeInviteCode(rawCode)
    return this.prisma.$transaction(async (tx) => {
      const [invite] = await tx.$queryRaw<{ id: string, library_id: string, expires_at: Date, uses: number, max_uses: number }[]>`
        SELECT id, library_id, expires_at, uses, max_uses FROM library_invites WHERE code = ${code} FOR UPDATE`
      if (!invite || invite.expires_at < new Date() || invite.uses >= invite.max_uses) {
        throw new DomainError(404, 'invalid_invite', 'This invite code is invalid or has expired')
      }
      const existing = await tx.libraryMember.findUnique({ where: { libraryId_userId: { libraryId: invite.library_id, userId } } })
      if (existing) {
        return { libraryId: invite.library_id }
      }
      const { permissions } = await tx.libraryInvite.findUniqueOrThrow({ where: { id: invite.id }, select: { permissions: true } })
      await tx.libraryMember.create({ data: { libraryId: invite.library_id, userId, role: 'member', permissions } })
      await tx.libraryInvite.update({ where: { id: invite.id }, data: { uses: { increment: 1 } } })
      return { libraryId: invite.library_id }
    })
  }
}
