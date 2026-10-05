import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { formatDate, formatRelative, isOverdue } from '~/utils/Dates'
import { errorMessage } from '~/utils/Errors'

const now = DateTime.fromISO('2026-10-05T12:00:00')

describe('dates', () => {
  it('formats relative days', () => {
    expect(formatRelative('2026-10-05T08:00:00', now)).toBe('today')
    expect(formatRelative('2026-10-04T08:00:00', now)).toBe('yesterday')
    expect(formatRelative('2026-10-06T08:00:00', now)).toBe('tomorrow')
    expect(formatRelative('2026-10-01T08:00:00', now)).toBe('4 days ago')
    expect(formatRelative('2026-10-15T08:00:00', now)).toBe('in 10 days')
    expect(formatRelative(null, now)).toBe('')
  })

  it('detects overdue loans', () => {
    expect(isOverdue('2026-10-04T23:59:59', now)).toBe(true)
    expect(isOverdue('2026-10-06T00:00:00', now)).toBe(false)
    expect(isOverdue(null, now)).toBe(false)
  })

  it('formats dates', () => {
    expect(formatDate('2026-10-05T12:00:00')).toBe('5 Oct 2026')
    expect(formatDate(null)).toBe('')
  })
})

describe('errors', () => {
  it('names the missing permission', () => {
    expect(errorMessage({ code: '42501', hint: 'loans.manage', message: 'x' })).toBe('You need the "Lend & return" permission for this.')
    expect(errorMessage({ code: '42501', message: 'x' })).toBe('You don\'t have permission to do this.')
    expect(errorMessage({ code: '23503', message: 'fk' })).toContain('still in use')
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage(null)).toBe('Something went wrong')
  })
})
