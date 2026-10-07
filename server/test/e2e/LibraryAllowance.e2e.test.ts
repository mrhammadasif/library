// TEST DATA ONLY. Per-library daily allowances for Google Books and web search; outbound HTTP is stubbed.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK, createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

function respond(body: unknown) {
  return new Response(JSON.stringify(body))
}

describe('per-library daily allowances', () => {
  let t: ITestApp
  let owner: ITestUser

  beforeAll(async () => {
    t = await createTestApp({ LIBRARY_DAILY_GOOGLE_BOOKS: '2', LIBRARY_DAILY_WEB_SEARCHES: '1', SEARXNG_URL: 'http://searxng.test:8080' })
  })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
  })

  function stub() {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('openlibrary')) {
        return respond({ 'ISBN:9780441172719': { title: 'Dune' } })
      }
      if (url.includes('googleapis')) {
        return respond({ items: [{ volumeInfo: { title: 'Dune' } }] })
      }
      if (url.startsWith('http://searxng.test')) {
        return respond({ results: [{ title: 'Dune by Frank Herbert', url: 'https://x', content: 'Dune · Ace · 1990' }] })
      }
      return respond({ choices: [{ message: { content: '{"categories":["Science Fiction"],"tags":["desert"],"description":"","language":"en"}' } }] })
    })
    vi.stubGlobal('fetch', fetchMock)
    return (host: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(host)).length
  }

  async function lookup(lib: string) {
    return t.http().post(`/api/libraries/${lib}/lookup`).set('Cookie', owner.cookie).send({ isbn: '9780441172719' }).expect(200)
  }

  it('gives each library its own Google Books allowance, then falls back to Open Library', async () => {
    const calls = stub()
    const first = await createLibrary(t, owner)
    const second = await createLibrary(t, owner, 'Office')
    for (let i = 0; i < 3; i++) {
      const res = await lookup(first)
      expect(res.body.draft.title).toBe('Dune')
      expect(res.body.sources.googleBooks).toBe(i < 2)
    }
    expect((await lookup(second)).body.sources.googleBooks).toBe(true)
    expect(calls('googleapis')).toBe(3)
  })

  it('exempts libraries the admin trusts with Home AI', async () => {
    const calls = stub()
    const trusted = await createLibrary(t, owner)
    await t.db.prisma.library.update({ where: { id: trusted }, data: { homeAiAllowed: true } })
    for (let i = 0; i < 4; i++) {
      expect((await lookup(trusted)).body.sources.googleBooks).toBe(true)
    }
    expect(calls('googleapis')).toBe(4)
    expect(await t.db.prisma.libraryDailyUsage.count()).toBe(0)
  })

  it('stops web searches after the allowance; enrichment still answers', async () => {
    const calls = stub()
    const lib = await createLibrary(t, owner)
    await t.http().put(`/api/libraries/${lib}/ai/providers/openai`).set('Cookie', owner.cookie).send({ model: 'gpt-x', apiKey: 'sk-test' }).expect(204)
    await t.http().put(`/api/libraries/${lib}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: 'openai', vision: null }).expect(204)
    const draft = { ...BOOK('Dune'), authors: ['Frank Herbert'], coverUrl: null }
    for (let i = 0; i < 2; i++) {
      const res = await t.http().post(`/api/libraries/${lib}/ai/enrich`).set('Cookie', owner.cookie).send({ draft }).expect(200)
      expect(res.body.enrichment.categories).toEqual(['Science Fiction'])
    }
    expect(calls('searxng.test')).toBe(1)
  })
})
