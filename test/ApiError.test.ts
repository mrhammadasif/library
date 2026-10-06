import { describe, expect, it } from 'vitest'
import { ApiError, buildQuery, toApiError } from '~/api/ApiError'
import { describePermissions } from '~/constants/Permissions'
import { errorMessage } from '~/utils/Errors'

describe('apiError', () => {
  it('builds query strings, skipping empty values and joining lists', () => {
    expect(buildQuery({ q: 'dune', tags: ['a', 'b'], color: null, status: undefined, empty: '', none: [], limit: 40, open: true }))
      .toBe('?q=dune&tags=a%2Cb&limit=40&open=true')
    expect(buildQuery({})).toBe('')
    expect(buildQuery()).toBe('')
  })

  it('reads the API error shape, with fallbacks', () => {
    const e = toApiError(403, { statusCode: 403, code: 'forbidden', message: 'No', permission: 'loans.manage' })
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 403, code: 'forbidden', message: 'No', permission: 'loans.manage' })
    expect(toApiError(502, 'Bad gateway')).toMatchObject({ code: 'http_502', message: 'Something went wrong' })
  })

  it('turns errors into friendly messages', () => {
    expect(errorMessage(toApiError(403, { code: 'forbidden', permission: 'loans.manage', message: 'x' }))).toBe('You need the "Borrow & give back" permission for this.')
    expect(errorMessage(toApiError(403, { code: 'email_unverified', message: 'x' }))).toContain('Verify your email')
    expect(errorMessage(toApiError(401, {}))).toContain('Sign in again')
    expect(errorMessage(toApiError(400, { code: 'invalid_input', message: 'x' }))).toBe('Some details are missing or wrong.')
    expect(errorMessage(toApiError(409, { code: 'not_on_shelf', message: 'Only books on a shelf can be borrowed' }))).toBe('Only books on a shelf can be borrowed')
    expect(errorMessage(new TypeError('Network request failed'))).toContain('internet')
    expect(errorMessage(null)).toBe('Something went wrong')
  })

  it('describes permission sets by preset', () => {
    expect(describePermissions(['loans.manage'])).toBe('Reader')
    expect(describePermissions(['audits.run', 'loans.manage'])).toBe('Helper')
    expect(describePermissions([])).toBe('Viewer')
    expect(describePermissions(['books.add'])).toBe('Add books')
    expect(describePermissions(['books.add', 'books.move'])).toBe('2 permissions')
  })
})
