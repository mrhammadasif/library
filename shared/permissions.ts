// The granular library permissions. Must match the library_permission enum in server/prisma/schema.prisma.
// UI labels and presets live in the app (src/constants/Permissions.ts).

export const PERMISSIONS = [
  'books.add',
  'books.edit',
  'books.move',
  'loans.manage',
  'books.archive',
  'books.delete',
  'shelves.manage',
  'audits.run',
  'members.manage',
  'ai.manage',
] as const

export type Permission = typeof PERMISSIONS[number]
