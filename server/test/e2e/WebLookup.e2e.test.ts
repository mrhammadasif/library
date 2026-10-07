// TEST DATA ONLY. "Find it online" without AI: SearXNG ISBNs become candidates; daily lookup allowance. HTTP is stubbed.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

const TITLE = 'Stories from the Battles of the Prophet Muhammad'

describe('free web lookup (no ai)', () => {
  let t: ITestApp
  let owner: ITestUser
  let lib: string
  const search = () => t.http().post(`/api/libraries/${lib}/lookup`).set('Cookie', owner.cookie).send({ title: TITLE, author: 'Yasmin G. Watson' })

  beforeAll(async () => {
    t = await createTestApp({ SEARXNG_URL: 'http://searxng.test:8080', SEARXNG_API_KEY: 'k', LIBRARY_DAILY_LOOKUPS: '3' })
  })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
    lib = await createLibrary(t, owner)
  })

  function stub({ databasesKnowIt }: { databasesKnowIt: boolean }) {
    const fetchMock = vi.fn(async (url: string) => {
      const json = (body: unknown) => new Response(JSON.stringify(body))
      if (url.startsWith('http://searxng.test')) {
        return json({ results: [
          { title: `${TITLE} - Amazon.in`, url: 'https://amazon.test/b', content: 'Watson, Yasmin G · ISBN-10: 1999802756 · Paperback' },
          { title: 'Some other book', url: 'https://x.test', content: 'ISBN 9780441172719' },
        ] })
      }
      if (url.includes('openlibrary.org/search.json')) {
        return json({ docs: databasesKnowIt ? [{ title: TITLE, author_name: ['Yasmin G. Watson'], isbn: ['9781999802752'] }] : [] })
      }
      if (url.includes('openlibrary.org/api/books')) {
        return json({ 'ISBN:9781999802752': { title: TITLE, authors: [{ name: 'Yasmin G. Watson' }], publishers: [{ name: 'Watson' }], publish_date: '2021' } })
      }
      return json({ items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    return (host: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(host)).length
  }

  it('finds the ISBN on the web when the databases have no match, without any AI', async () => {
    const calls = stub({ databasesKnowIt: false })
    const res = await search().expect(200)
    expect(res.body.candidates).toEqual([expect.objectContaining({ title: TITLE, isbn13: '9781999802752', isbn10: '1999802756', publisher: 'Watson', publishedYear: 2021 })])
    // Only the result about this book counts: the other book's ISBN is ignored.
    expect(res.body.candidates.some((c: { isbn13: string }) => c.isbn13 === '9780441172719')).toBe(false)
    expect(calls('searxng.test')).toBe(1)
  })

  it('skips the web search when a database result already matches with an ISBN', async () => {
    const calls = stub({ databasesKnowIt: true })
    const res = await search().expect(200)
    expect(res.body.candidates[0]).toMatchObject({ isbn13: '9781999802752' })
    expect(calls('searxng.test')).toBe(0)
  })

  it('stops after the library\'s daily lookups with a clear message', async () => {
    stub({ databasesKnowIt: true })
    for (let i = 0; i < 3; i++) {
      await search().expect(200)
    }
    expect((await search().expect(429)).body).toMatchObject({ code: 'lookup_limit', message: expect.stringContaining('3 online lookups') })
  })
})
