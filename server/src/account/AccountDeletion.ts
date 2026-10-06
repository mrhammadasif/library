import type { PrismaClient } from '../generated/prisma/client'

export class LastOwnerError extends Error {
  constructor(public libraryNames: string[]) {
    super(`You're the only owner of ${libraryNames.join(', ')}. Make someone else an owner first.`)
  }
}

/**
 * Runs before a user is deleted. Blocks while they're the last owner of a library other people use; deletes libraries
 * nobody else is in; keeps loan history readable (borrower_name stays, the link to the account goes).
 */
export async function prepareAccountDeletion(prisma: PrismaClient, userId: string): Promise<void> {
  const owned = await prisma.libraryMember.findMany({
    where: { userId, role: 'owner' },
    select: { library: { select: { id: true, name: true, members: { select: { userId: true, role: true } } } } },
  })
  const blocking = owned.filter(({ library }) =>
    !library.members.some(m => m.userId !== userId && m.role === 'owner')
    && library.members.some(m => m.userId !== userId))
  if (blocking.length) {
    throw new LastOwnerError(blocking.map(b => b.library.name))
  }
  const solo = owned.filter(({ library }) => library.members.every(m => m.userId === userId)).map(o => o.library.id)
  await prisma.$transaction([
    prisma.library.deleteMany({ where: { id: { in: solo } } }),
    prisma.loan.updateMany({ where: { borrowerUserId: userId }, data: { borrowerUserId: null } }),
  ])
}
