// TEST DATA ONLY. The free AI tier: a few suggestions per library per day through the owner's gateway, capped server-wide.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOK, createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

describe('free ai tier', () => {
  let t: ITestApp
  let owner: ITestUser
  const draft = { ...BOOK('Dune'), coverUrl: null }
  const enrich = (lib: string) => t.http().post(`/api/libraries/${lib}/ai/enrich`).set('Cookie', owner.cookie).send({ draft })

  beforeAll(async () => {
    t = await createTestApp({ FREE_AI_BASE_URL: 'http://free-ai.test/v1', FREE_AI_API_KEY: 'owner-gateway-key', FREE_AI_PER_LIBRARY: '2', FREE_AI_DAILY_TOTAL: '3' })
  })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
  })

  function stub() {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"categories":["Science Fiction"],"tags":["desert"],"description":"","language":"en"}' } }] })))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('gives a library without a key a few suggestions a day, then a clear message', async () => {
    const fetchMock = stub()
    const lib = await createLibrary(t, owner)
    expect((await enrich(lib).expect(200)).body).toMatchObject({ provider: 'free', enrichment: { categories: ['Science Fiction'] } })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://free-ai.test/v1/chat/completions')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer owner-gateway-key' })
    expect(JSON.parse(init.body as string).model).toBe('hammad/free')
    await enrich(lib).expect(200)
    expect((await enrich(lib).expect(429)).body).toMatchObject({ code: 'free_ai_used_up', message: expect.stringContaining('2 free') })
    expect((await t.http().get(`/api/libraries/${lib}/ai/limit`).set('Cookie', owner.cookie).expect(200)).body.free).toEqual({ perDay: 2, usedToday: 2 })
    expect((await t.http().get('/api/me').set('Cookie', owner.cookie).expect(200)).body.freeAiPerDay).toBe(2)
  })

  it('caps the free tier across all libraries; trusted libraries skip only their own cap', async () => {
    stub()
    const a = await createLibrary(t, owner, 'A')
    const trusted = await createLibrary(t, owner, 'B')
    await t.db.prisma.library.update({ where: { id: trusted }, data: { trusted: true } })
    await enrich(a).expect(200)
    await enrich(a).expect(200)
    await enrich(trusted).expect(200)
    expect((await enrich(trusted).expect(429)).body.code).toBe('free_ai_busy')
  })

  it('never uses the free tier once a library has its own key', async () => {
    const fetchMock = stub()
    const lib = await createLibrary(t, owner)
    await t.http().put(`/api/libraries/${lib}/ai/providers/gemini`).set('Cookie', owner.cookie).send({ model: 'gemini-3.1-flash-lite', apiKey: 'own-key' }).expect(204)
    await t.http().put(`/api/libraries/${lib}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: 'gemini', vision: null }).expect(204)
    for (let i = 0; i < 4; i++) {
      expect((await enrich(lib).expect(200)).body.provider).toBe('gemini')
    }
    expect((fetchMock.mock.calls as unknown as [string][]).every(([url]) => url.startsWith('https://generativelanguage.googleapis.com'))).toBe(true)
  })

  it('never reads cover photos with the free tier: that needs the library\'s own key', async () => {
    const fetchMock = stub()
    const lib = await createLibrary(t, owner)
    const res = await t.http().post(`/api/libraries/${lib}/ai/identify-cover`).set('Cookie', owner.cookie).send({ imageBase64: 'x'.repeat(200) }).expect(409)
    expect(res.body.code).toBe('ai_not_configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
