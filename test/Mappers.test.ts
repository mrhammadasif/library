import type { IBookRow } from '~/mappers/SupabaseMapper'
import { describe, expect, it } from 'vitest'
import { ALL_PERMISSIONS, describePermissions } from '~/constants/Permissions'
import { toAudit, toBook, toBookPayload, toMembership, toRack } from '~/mappers/SupabaseMapper'
import { emptyFields } from '~/utils/BookForm'

// TEST DATA ONLY
const row: IBookRow = {
  id: 'b1', library_id: 'l1', isbn13: '9780441172719', isbn10: null, title: 'Dune', subtitle: null, authors: ['Frank Herbert'],
  publisher: null, published_year: 1965, pages: 412, language: 'en', description: null, categories: [], tags: ['classic'],
  cover_path: null, cover_url: null, dominant_color: '#C98A12', color_name: 'orange', condition: null, notes: null,
  status: 'on_shelf', shelf_id: 's1', archived_at: null, archive_reason: null, donated_to: null, last_seen_at: null,
  created_at: '2026-10-05T10:00:00Z',
}

describe('supabaseMapper', () => {
  it('maps book rows', () => {
    const book = toBook(row)
    expect(book.publishedYear).toBe(1965)
    expect(book.shelfId).toBe('s1')
    expect(book.colorName).toBe('orange')
  })

  it('builds clean payloads: trimmed, blanks to null, tags lowercased and unique', () => {
    const payload = toBookPayload({ ...emptyFields(), title: '  Dune ', subtitle: '  ', authors: [' Frank Herbert ', ''], tags: ['Classic', 'classic', 'SciFi'] })
    expect(payload.title).toBe('Dune')
    expect(payload.subtitle).toBeNull()
    expect(payload.authors).toEqual(['Frank Herbert'])
    expect(payload.tags).toEqual(['classic', 'scifi'])
  })

  it('gives owners every permission', () => {
    const library = { id: 'l1', name: 'Home', enrich_provider: null, vision_provider: 'openai' as const }
    expect(toMembership({ role: 'owner', permissions: [], library })!.permissions).toEqual(ALL_PERMISSIONS)
    expect(toMembership({ role: 'member', permissions: ['audits.run'], library })!.permissions).toEqual(['audits.run'])
    expect(toMembership({ role: 'member', permissions: [], library: null })).toBeNull()
  })

  it('sorts shelves and reads book counts', () => {
    const rack = toRack({
      id: 'r1', name: 'Hall', notes: null, position: 1,
      shelves: [
        { id: 's2', rack_id: 'r1', name: 'Bottom', notes: null, position: 2, books: [{ count: 3 }] },
        { id: 's1', rack_id: 'r1', name: 'Top', notes: null, position: 1, books: [] },
      ],
    })
    expect(rack.shelves.map(s => s.name)).toEqual(['Top', 'Bottom'])
    expect(rack.shelves[1].bookCount).toBe(3)
    expect(rack.shelves[0].bookCount).toBe(0)
  })

  it('counts audit results', () => {
    const audit = toAudit({ id: 'a1', mode: 'random', shelf_id: null, sample_size: 3, started_at: '', completed_at: null,
      items: [{ result: 'found' }, { result: 'found' }, { result: 'missing' }] })
    expect(audit.counts).toEqual({ pending: 0, found: 2, missing: 1, misplaced: 0, unexpected: 0 })
  })

  it('describes permission sets by preset', () => {
    expect(describePermissions(['loans.manage'])).toBe('Reader')
    expect(describePermissions(['audits.run', 'loans.manage'])).toBe('Helper')
    expect(describePermissions([])).toBe('Viewer')
    expect(describePermissions(['books.add'])).toBe('Add books')
    expect(describePermissions(['books.add', 'books.move'])).toBe('2 permissions')
  })
})

describe('supabaseMapper relations', () => {
  it('maps members, invites, loans, events, audit items and AI providers', async () => {
    const m = await import('~/mappers/SupabaseMapper')
    expect(m.toMember({ user_id: 'u', role: 'member', permissions: [], created_at: 't', profile: null }).displayName).toBe('Member')
    expect(m.toInvite({ id: 'i', code: 'ABCD2345', permissions: [], expires_at: 't', max_uses: 2, uses: 1 }).maxUses).toBe(2)
    expect(m.toLoan({ id: 'l', book_id: 'b', borrower_user_id: null, borrower_name: 'Sam', borrower_contact: null, notes: null,
      lent_at: 't', due_at: null, returned_at: null, book: null }).bookTitle).toBe('')
    expect(m.toEvent({ id: 1, type: 'moved', from_shelf_id: 'a', to_shelf_id: 'b', payload: null as unknown as Record<string, unknown>,
      at: 't', actor_profile: { display_name: 'Olive' } })).toMatchObject({ actorName: 'Olive', payload: {} })
    const item = m.toAuditItem({ id: 'x', book_id: null, expected_shelf_id: null, found_shelf_id: 's', scanned_isbn: '978', result: 'unexpected', book: null },
      () => 'never')
    expect(item).toMatchObject({ bookTitle: null, coverUri: null, bookAuthors: [] })
    const withBook = m.toAuditItem({ id: 'y', book_id: 'b', expected_shelf_id: 's', found_shelf_id: null, scanned_isbn: null, result: 'pending',
      book: { title: 'Dune', authors: ['F'], cover_path: 'p', cover_url: null, dominant_color: null } }, path => `uri:${path}`)
    expect(withBook.coverUri).toBe('uri:p')
    expect(m.toAiProvider({ provider: 'gemini', model: 'g', base_url: null, supports_vision: true, has_key: true }).hasKey).toBe(true)
  })
})
