// TEST DATA ONLY. Saving a library AI key tests it first; outbound HTTP is stubbed.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

describe('ai key check on save', () => {
  let t: ITestApp
  let owner: ITestUser
  let lib: string
  const put = (body: Record<string, unknown>) => t.http().put(`/api/libraries/${lib}/ai/providers/gemini`).set('Cookie', owner.cookie).send(body)

  beforeAll(async () => { t = await createTestApp({ AI_KEY_CHECK: 'true' }) })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
    lib = await createLibrary(t, owner)
  })

  function stub(status: number, body: unknown = { choices: [{ message: { content: '{"ok":true}' } }] }) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('saves a working key after one tiny request to the provider', async () => {
    const fetchMock = stub(200)
    await put({ model: 'gemini-3.1-flash-lite', apiKey: 'good-key' }).expect(204)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer good-key' })
    expect(await t.db.prisma.libraryAiProvider.count()).toBe(1)
  })

  it('refuses a bad key or model with a message people can act on, and stores nothing', async () => {
    stub(401, { error: 'bad key' })
    expect((await put({ model: 'gemini-3.1-flash-lite', apiKey: 'bad' }).expect(400)).body.code).toBe('invalid_key')
    stub(404, { error: 'no such model' })
    const res = await put({ model: 'gemini-9', apiKey: 'good-key' }).expect(400)
    expect(res.body).toMatchObject({ code: 'invalid_model', message: expect.stringContaining('gemini-9') })
    stub(503, { error: 'down' })
    expect((await put({ model: 'gemini-3.1-flash-lite', apiKey: 'good-key' }).expect(400)).body.code).toBe('provider_unreachable')
    expect(await t.db.prisma.libraryAiProvider.count()).toBe(0)
  })

  it('accepts a rate-limited key and skips the check when nothing changed', async () => {
    stub(429, { error: 'slow down' })
    await put({ model: 'gemini-3.1-flash-lite', apiKey: 'busy-key' }).expect(204)
    const fetchMock = stub(500)
    await put({ model: 'gemini-3.1-flash-lite', apiKey: '' }).expect(204)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
