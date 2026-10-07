// TEST DATA ONLY. AI enrichment reading SearXNG web results; outbound HTTP (SearXNG, the library's AI provider) is stubbed.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK, createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

function respond(body: unknown) {
  return new Response(JSON.stringify(body))
}

const WEB = { results: [{ title: 'Stories from the Battles of the Prophet Muhammad', url: 'https://shop.test/b', content: 'Yasmin G. Watson · ISBN 978-1-999802-75-2 · 2021 · 64 pages' }] }

function aiReply(isbn: string) {
  return { choices: [{ message: { content: JSON.stringify({ categories: ['Islamic', 'Children'], tags: ['muhammad', 'stories'], description: 'Battles of the Prophet, retold for children.', language: 'en', isbn, publisher: 'Watson', year: 2021, pages: 64 }) } }] }
}

describe('ai enrichment with web search', () => {
  let t: ITestApp
  let owner: ITestUser
  let lib: string
  const draft = { ...BOOK('Stories from the Battles of the Prophet Muhammad'), authors: ['Yasmin G. Watson'], coverUrl: null }

  beforeAll(async () => { t = await createTestApp({ SEARXNG_URL: 'http://searxng.test:8080', SEARXNG_API_KEY: 'test-searxng-key' }) })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
    lib = await createLibrary(t, owner)
    // The library's own key (key check is off in tests, so no request is made here).
    await t.http().put(`/api/libraries/${lib}/ai/providers/gemini`).set('Cookie', owner.cookie).send({ model: 'gemini-3.1-flash-lite', apiKey: 'own-key' }).expect(204)
    await t.http().put(`/api/libraries/${lib}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: 'gemini', vision: null }).expect(204)
  })

  function stub(ai: unknown) {
    const fetchMock = vi.fn(async (url: string) => respond(String(url).startsWith('http://searxng.test') ? WEB : ai))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('gives the AI the web results and keeps the ISBN printed there', async () => {
    const fetchMock = stub(aiReply('9781999802752'))
    const res = await t.http().post(`/api/libraries/${lib}/ai/enrich`).set('Cookie', owner.cookie).send({ draft }).expect(200)
    expect(res.body.enrichment).toMatchObject({ categories: ['Islamic', 'Children'], isbn13: '9781999802752', publisher: 'Watson', publishedYear: 2021, pages: 64 })
    const [searchUrl] = fetchMock.mock.calls[0] as unknown as [string]
    expect(new URL(searchUrl).searchParams.get('q')).toBe('"Stories from the Battles of the Prophet Muhammad" Yasmin G. Watson book isbn')
    const prompt = JSON.parse(JSON.parse((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).messages[1].content)
    expect(prompt.web[0].snippet).toContain('978-1-999802-75-2')
  })

  it('never takes an ISBN the AI made up; uses the one the results print', async () => {
    stub(aiReply('9780441172719'))
    const res = await t.http().post(`/api/libraries/${lib}/ai/enrich`).set('Cookie', owner.cookie).send({ draft }).expect(200)
    expect(res.body.enrichment.isbn13).toBe('9781999802752')
  })

  it('sends the SearXNG key with the search', async () => {
    const fetchMock = stub(aiReply(''))
    await t.http().post(`/api/libraries/${lib}/ai/enrich`).set('Cookie', owner.cookie).send({ draft }).expect(200)
    const [, searchInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(searchInit.headers).toMatchObject({ 'X-API-Key': 'test-searxng-key' })
  })

  it('skips the web search when the book is already complete', async () => {
    const fetchMock = stub(aiReply(''))
    const complete = { ...draft, isbn13: '9781999802752', publisher: 'Watson', publishedYear: 2021, pages: 64, description: 'Known.', categories: ['Islamic'] }
    await t.http().post(`/api/libraries/${lib}/ai/enrich`).set('Cookie', owner.cookie).send({ draft: complete }).expect(200)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'])
  })
})
