// TEST DATA ONLY. A library's own daily cap on AI requests; outbound HTTP is stubbed.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addMember, BOOK, createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

describe('library ai daily limit', () => {
  let t: ITestApp
  let owner: ITestUser
  let lib: string
  const draft = { ...BOOK('Dune'), coverUrl: null }
  const enrich = () => t.http().post(`/api/libraries/${lib}/ai/enrich`).set('Cookie', owner.cookie).send({ draft })

  beforeAll(async () => { t = await createTestApp() })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
    lib = await createLibrary(t, owner)
    await t.http().put(`/api/libraries/${lib}/ai/providers/gemini`).set('Cookie', owner.cookie).send({ model: 'gemini-3.1-flash-lite', apiKey: 'own-key' }).expect(204)
    await t.http().put(`/api/libraries/${lib}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: 'gemini', vision: 'gemini' }).expect(204)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"categories":[],"tags":["spice"],"description":"","language":"en"}' } }] }))))
  })

  it('counts AI requests with no limit, then stops at the limit the library chose', async () => {
    await enrich().expect(200)
    expect((await t.http().get(`/api/libraries/${lib}/ai/limit`).set('Cookie', owner.cookie).expect(200)).body).toEqual({ dailyLimit: null, usedToday: 1, free: null })

    await t.http().put(`/api/libraries/${lib}/ai/limit`).set('Cookie', owner.cookie).send({ dailyLimit: 2 }).expect(204)
    await enrich().expect(200)
    const res = await enrich().expect(429)
    expect(res.body).toMatchObject({ code: 'ai_daily_limit', message: expect.stringContaining('2 a day') })
    // Cover photos use the same allowance.
    await t.http().post(`/api/libraries/${lib}/ai/identify-cover`).set('Cookie', owner.cookie).send({ imageBase64: 'x'.repeat(200) }).expect(429)
    expect((await t.http().get(`/api/libraries/${lib}/ai/limit`).set('Cookie', owner.cookie).expect(200)).body).toEqual({ dailyLimit: 2, usedToday: 2, free: null })

    await t.http().put(`/api/libraries/${lib}/ai/limit`).set('Cookie', owner.cookie).send({ dailyLimit: null }).expect(204)
    await enrich().expect(200)
  })

  it('only AI managers set it, and it must be a sensible number', async () => {
    const helper = await signUp(t, 'helper@test.local')
    await addMember(t, lib, helper, ['books.add'])
    await t.http().put(`/api/libraries/${lib}/ai/limit`).set('Cookie', helper.cookie).send({ dailyLimit: 5 }).expect(403)
    await t.http().put(`/api/libraries/${lib}/ai/limit`).set('Cookie', owner.cookie).send({ dailyLimit: 0 }).expect(400)
    const libs = await t.http().get('/api/libraries').set('Cookie', owner.cookie).expect(200)
    expect(libs.body[0].library.aiDailyLimit).toBeNull()
  })
})
