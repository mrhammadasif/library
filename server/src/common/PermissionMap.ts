import type { Permission } from '../../../shared/permissions'
import type { LibraryPermission } from '../generated/prisma/client'

/** Prisma enum keys (booksAdd) ↔ wire values (books.add). */
const ENUM_TO_PERMISSION: Record<string, Permission> = {
  booksAdd: 'books.add',
  booksEdit: 'books.edit',
  booksMove: 'books.move',
  loansManage: 'loans.manage',
  booksArchive: 'books.archive',
  booksDelete: 'books.delete',
  shelvesManage: 'shelves.manage',
  auditsRun: 'audits.run',
  membersManage: 'members.manage',
  aiManage: 'ai.manage',
}

export function toPermission(value: string): Permission {
  return ENUM_TO_PERMISSION[value] ?? (value as Permission)
}

export function toEnumPermission(permission: Permission): LibraryPermission {
  return Object.entries(ENUM_TO_PERMISSION).find(([, p]) => p === permission)![0] as LibraryPermission
}
