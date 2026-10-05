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
  { key: 'loans.manage', label: 'Lend & return', description: 'Mark books as lent out or returned', icon: 'repeat' },
  { key: 'books.archive', label: 'Donate & archive', description: 'Donate books or restore them from the archive', icon: 'gift' },
  { key: 'books.delete', label: 'Delete books', description: 'Permanently remove book records', icon: 'trash-2' },
  { key: 'shelves.manage', label: 'Manage shelves', description: 'Create, rename, sort and remove racks and shelves', icon: 'layers' },
  { key: 'audits.run', label: 'Run audits', description: 'Check that books are where they should be', icon: 'check-square' },
  { key: 'members.manage', label: 'Manage members', description: 'Invite people and change their permissions', icon: 'users' },
  { key: 'ai.manage', label: 'Manage AI keys', description: 'Set up OpenAI, Gemini or Ollama for this library', icon: 'cpu' },
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
  { name: 'Lender', description: 'Only lend and return books', permissions: ['loans.manage'] },
  { name: 'Auditor', description: 'Only run audits', permissions: ['audits.run'] },
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
