import type { Permission } from '../../../shared/permissions'
import type { IMembership } from './Access'
import { DomainError } from '../common/DomainError'

/** For secondary checks inside a service (e.g. returning a book to a different shelf also needs books.move). */
export function requirePermission(m: IMembership, permission: Permission): void {
  if (!m.permissions.includes(permission)) {
    throw new DomainError(403, 'forbidden', 'You don\'t have permission to do this', { permission })
  }
}
