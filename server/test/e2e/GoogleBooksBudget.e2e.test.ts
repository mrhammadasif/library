// TEST DATA ONLY. The Google Books daily cap: atomic, per Pacific day, and lookups fall back to Open Library when spent.
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoogleBooksBudget } from '../../src/books-budget/GoogleBooksBudget'
import { pacificDay } from '../../src/books-budget/PacificDay'
import { addMember, createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

describe('google books budget', () => {
  let t: ITestApp
  let budget: GoogleBooksBudget

  beforeAll(async () => {
    t = await createTestApp({ GOOGLE_BOOKS_API_KEY: 'test-books-key', GOOGLE_BOOKS_DAILY_LIMIT: '3' })
    budget = t.app.get(GoogleBooksBudget)
  })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(() => t.db.reset())

  it('uses Pacific days (Google resets its quota at midnight Pacific)', () => {
    expect(pacificDay(new Date('2026-10-07T06:30:00Z'))).toBe('2026-10-06')
    expect(pacificDay(new Date('2026-10-07T08:30:00Z'))).toBe('2026-10-07')
  })

  it('allows exactly the daily limit, even when requests race, then resets the next day', async () => {
    const day1 = new Date('2026-10-07T20:00:00Z')
    const results = await Promise.all(Array.from({ length: 6 }, () => budget.take(day1)))
    expect(results.filter(Boolean)).toHaveLength(3)
    expect(await budget.take(day1)).toBe(false)
    expect((await t.db.prisma.googleBooksUsage.findFirstOrThrow()).count).toBe(3)
    expect(await budget.take(new Date('2026-10-08T20:00:00Z'))).toBe(true)
  })

  it('stops calling Google once the budget is spent but still answers from Open Library', async () => {
    const owner = await signUp(t, 'owner@test.local')
    const lib = await createLibrary(t, owner)
    await addMember(t, lib, await signUp(t, 'viewer@test.local'), [])
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('openlibrary')
      ? { 'ISBN:9780441172719': { title: 'Dune' } }
      : { items: [{ volumeInfo: { title: 'Dune', categories: ['Fiction / Science Fiction'] } }] })))
    vi.stubGlobal('fetch', fetchMock)
    const googleCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('googleapis')).length

    for (let i = 0; i < 5; i++) {
      const res = await t.http().post(`/api/libraries/${lib}/lookup`).set('Cookie', owner.cookie).send({ isbn: '9780441172719' }).expect(200)
      expect(res.body.draft.title).toBe('Dune')
      expect(res.body.sources.googleBooks).toBe(i < 3)
    }
    expect(googleCalls()).toBe(3)
    expect(String(fetchMock.mock.calls.find(([url]) => String(url).includes('googleapis'))![0])).toContain('key=test-books-key')
  })
})
