import { DateTime } from 'luxon'

export function formatDate(iso: string | null | undefined): string {
  return iso ? DateTime.fromISO(iso).toFormat('d LLL yyyy') : ''
}

/** "today", "yesterday", "3 days ago", "in 5 days". */
export function formatRelative(iso: string | null | undefined, now: DateTime = DateTime.now()): string {
  if (!iso) {
    return ''
  }
  const date = DateTime.fromISO(iso).startOf('day')
  const days = Math.round(date.diff(now.startOf('day'), 'days').days)
  if (days === 0) {
    return 'today'
  }
  if (days === -1) {
    return 'yesterday'
  }
  if (days === 1) {
    return 'tomorrow'
  }
  return days < 0 ? `${-days} days ago` : `in ${days} days`
}

export function isOverdue(dueIso: string | null | undefined, now: DateTime = DateTime.now()): boolean {
  return !!dueIso && DateTime.fromISO(dueIso) < now
}
