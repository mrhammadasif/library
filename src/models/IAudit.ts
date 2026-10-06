import type { IAuditDto, IAuditItemDto } from '~shared/contracts/Audits'

export type IAudit = IAuditDto
export type AuditMode = IAuditDto['mode']
export type AuditResult = IAuditItemDto['result']

/** An audit item with its cover resolved to a URL for display. */
export interface IAuditItem extends IAuditItemDto {
  coverUri: string | null
}
