import type { ComponentProps } from 'react'
import type { Feather } from '@expo/vector-icons'

export type Permission =
  | 'books.add'
  | 'books.edit'
  | 'books.move'
  | 'loans.manage'
  | 'books.archive'
  | 'books.delete'
  | 'shelves.manage'
  | 'audits.run'
  | 'members.manage'
  | 'ai.manage'

interface IPermissionInfo {
  key: Permission
  label: string
  description: string
  icon: ComponentProps<typeof Feather>['name']
}

/** Every grantable permission, in display order. Must match the library_permission enum. */
export const PERMISSIONS: IPermissionInfo[] = [
  { key: 'books.add', label: 'Add books', description: 'Scan, photograph or type in new books', icon: 'plus-square' },
  { key: 'books.edit', label: 'Edit books', description: 'Change titles, covers, tags and colours', icon: 'edit-3' },
  { key: 'books.move', label: 'Move books', description: 'Move books between shelves', icon: 'shuffle' },
  { key: 'loans.manage', label: 'Borrow & give back', description: 'Borrow books, lend them out and mark them returned', icon: 'book-open' },
  { key: 'books.archive', label: 'Give away', description: 'Mark books as given away or lost, and bring them back', icon: 'gift' },
  { key: 'books.delete', label: 'Delete books', description: 'Permanently remove book records', icon: 'trash-2' },
  { key: 'shelves.manage', label: 'Set up shelves', description: 'Add, rename, sort and remove bookcases and shelves', icon: 'layers' },
  { key: 'audits.run', label: 'Book checks', description: 'Check that books are where they should be', icon: 'check-square' },
  { key: 'members.manage', label: 'Manage members', description: 'Invite people and change their permissions', icon: 'users' },
  { key: 'ai.manage', label: 'Smart helpers (AI)', description: 'Set up OpenAI, Gemini or Ollama keys for this library', icon: 'cpu' },
]

export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map(p => p.key)

interface IPreset {
  name: string
  description: string
  permissions: Permission[]
}

/** Templates that fill the permission toggles; nothing stores the preset itself. */
export const PRESETS: IPreset[] = [
  {
    name: 'Editor',
    description: 'Everything except members and AI keys',
    permissions: ['books.add', 'books.edit', 'books.move', 'loans.manage', 'books.archive', 'books.delete', 'shelves.manage', 'audits.run'],
  },
  { name: 'Reader', description: 'Borrow and give back books (great for kids)', permissions: ['loans.manage'] },
  { name: 'Helper', description: 'Borrow, give back and do book checks', permissions: ['loans.manage', 'audits.run'] },
  { name: 'Checker', description: 'Only do book checks', permissions: ['audits.run'] },
  { name: 'Viewer', description: 'Browse, search and see reports', permissions: [] },
]

export function permissionLabel(key: string): string {
  return PERMISSIONS.find(p => p.key === key)?.label ?? key
}

/** "Lender" when the set matches a preset exactly, else a short summary like "3 permissions". */
export function describePermissions(permissions: Permission[]): string {
  const sorted = [...permissions].sort().join(',')
  const preset = PRESETS.find(p => [...p.permissions].sort().join(',') === sorted)
  if (preset) {
    return preset.name
  }
  return permissions.length === 1 ? permissionLabel(permissions[0]) : `${permissions.length} permissions`
}
