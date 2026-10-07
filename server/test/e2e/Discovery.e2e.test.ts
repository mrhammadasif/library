// TEST DATA ONLY. Search, tags, stats, lookup, AI and covers. Outbound HTTP (book APIs, AI) is stubbed.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addMember, BOOK, createLibrary, createShelves, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

function respond(body: unknown, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

describe('search, stats, lookup, AI and covers', () => {
  let t: ITestApp
  let owner: ITestUser
  let viewer: ITestUser
  let lib: string
  let shelves: { rackId: string, top: string, middle: string }
  const base = () => `/api/libraries/${lib}`

  beforeAll(async () => { t = await createTestApp() })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllGlobals())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
    viewer = await signUp(t, 'viewer@test.local')
    lib = await createLibrary(t, owner)
    await addMember(t, lib, viewer, [])
    shelves = await createShelves(t, lib)
  })

  async function add(title: string, extra: Record<string, unknown> = {}) {
    const res = await t.http().post(`${base()}/books`).set('Cookie', owner.cookie).send({ shelfId: shelves.top, book: BOOK(title, extra) }).expect(201)
    return res.body.id as string
  }

  describe('search', () => {
    beforeEach(async () => {
      await add('Dune', { authors: ['Frank Herbert'], isbn13: '9780441172719', tags: ['scifi', 'classic'], colorName: 'orange' })
      await add('The Hobbit', { authors: ['J. R. R. Tolkien'], tags: ['fantasy', 'classic'], colorName: 'green' })
      await add('Clean Code', { authors: ['Robert C. Martin'], description: 'Writing readable programs' })
    })
    const titles = (body: { title: string }[]) => body.map(b => b.title).sort()

    it.each([
      ['title words', 'q=dune', ['Dune']],
      ['partial author', 'q=tolk', ['The Hobbit']],
      ['typo (trigram)', 'q=hobit', ['The Hobbit']],
      ['ISBN with dashes', 'q=978-0441172719', ['Dune']],
      ['description words', 'q=readable', ['Clean Code']],
      ['tag', 'tags=classic', ['Dune', 'The Hobbit']],
      ['two tags (all must match)', 'tags=classic,scifi', ['Dune']],
      ['colour', 'color=green', ['The Hobbit']],
      ['nothing', 'q=zzzzqqq', []],
    ])('finds by %s', async (_name, query, expected) => {
      const res = await t.http().get(`${base()}/search?${query}`).set('Cookie', viewer.cookie).expect(200)
      expect(titles(res.body)).toEqual(expected)
    })

    it('lists newest first without a query, hides given-away books unless asked', async () => {
      const res = await t.http().get(`${base()}/search`).set('Cookie', viewer.cookie).expect(200)
      expect(res.body.map((b: { title: string }) => b.title)).toEqual(['Clean Code', 'The Hobbit', 'Dune'])
      const dune = res.body[2].id
      await t.http().post(`${base()}/books/archive`).set('Cookie', owner.cookie).send({ bookIds: [dune] }).expect(200)
      expect((await t.http().get(`${base()}/search?q=dune`).set('Cookie', viewer.cookie)).body).toEqual([])
      expect((await t.http().get(`${base()}/search?q=dune&status=archived`).set('Cookie', viewer.cookie)).body).toHaveLength(1)
    })

    it('counts tags and builds stats', async () => {
      const tags = await t.http().get(`${base()}/tags`).set('Cookie', viewer.cookie).expect(200)
      expect(tags.body[0]).toEqual({ tag: 'classic', books: 2 })
      const stats = await t.http().get(`${base()}/stats`).set('Cookie', viewer.cookie).expect(200)
      expect(stats.body).toMatchObject({ total: 3, archived: 0, byStatus: { on_shelf: 3 }, authors: 3, loans: { open: 0, overdue: 0 } })
      expect(stats.body.racks[0]).toMatchObject({ name: 'Living room', books: 3 })
      expect(stats.body.topTags[0]).toEqual({ name: 'classic', books: 2 })
      expect(stats.body.addedByMonth).toHaveLength(1)
      expect(stats.body.audit.last).toBeNull()
    })
  })

  describe('lookup', () => {
    it('merges Open Library and Google Books for an ISBN and reports copies already here', async () => {
      await add('Dune', { isbn13: '9780441172719' })
      vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('openlibrary')
        ? respond({ 'ISBN:9780441172719': { title: 'Dune', authors: [{ name: 'Frank Herbert' }], number_of_pages: 528 } })
        : respond({ items: [{ volumeInfo: { title: 'Dune', description: 'Desert planet.', categories: ['Fiction / Science Fiction'] } }] })))
      const res = await t.http().post(`${base()}/lookup`).set('Cookie', viewer.cookie).send({ isbn: '0441172717' }).expect(200)
      expect(res.body.draft).toMatchObject({ title: 'Dune', isbn13: '9780441172719', isbn10: '0441172717', pages: 528, description: 'Desert planet.' })
      expect(res.body.existingCopies).toHaveLength(1)
    })

    it('rejects a bad ISBN', async () => {
      const res = await t.http().post(`${base()}/lookup`).set('Cookie', viewer.cookie).send({ isbn: '1234' }).expect(400)
      expect(res.body.code).toBe('invalid_isbn')
    })
  })

  describe('AI', () => {
    it('stores keys encrypted, never returns them, and keeps the key when only the model changes', async () => {
      await t.http().put(`${base()}/ai/providers/openai`).set('Cookie', owner.cookie).send({ model: 'gpt-x', apiKey: 'sk-secret-123' }).expect(204)
      const row = await t.db.prisma.libraryAiProvider.findFirstOrThrow()
      expect(row.keyCiphertext).not.toContain('sk-secret')
      const list = await t.http().get(`${base()}/ai/providers`).set('Cookie', viewer.cookie).expect(200)
      expect(list.body).toEqual([{ provider: 'openai', model: 'gpt-x', baseUrl: null, supportsVision: true, hasKey: true }])
      expect(JSON.stringify(list.body)).not.toContain('sk-secret')
      await t.http().put(`${base()}/ai/providers/openai`).set('Cookie', owner.cookie).send({ model: 'gpt-y' }).expect(204)
      expect((await t.db.prisma.libraryAiProvider.findFirstOrThrow()).keyCiphertext).toBe(row.keyCiphertext)
    })

    it('requires https for self-hosted gateways and a key for new providers', async () => {
      const http = await t.http().put(`${base()}/ai/providers/openai_compatible`).set('Cookie', owner.cookie).send({ model: 'm', baseUrl: 'http://lan:11434/v1', apiKey: 'k' }).expect(400)
      expect(http.body.code).toBe('https_required')
      const noKey = await t.http().put(`${base()}/ai/providers/gemini`).set('Cookie', owner.cookie).send({ model: 'g' }).expect(400)
      expect(noKey.body.code).toBe('key_required')
    })

    it('enriches with the chosen provider, sending the decrypted key', async () => {
      await t.http().put(`${base()}/ai/providers/openai`).set('Cookie', owner.cookie).send({ model: 'gpt-x', apiKey: 'sk-secret-123' }).expect(204)
      await t.http().put(`${base()}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: 'openai', vision: null }).expect(204)
      const fetchMock = vi.fn(async () => respond({ choices: [{ message: { content: '{"categories":["Science Fiction"],"tags":["desert"],"description":"A story.","language":"en"}' } }] }))
      vi.stubGlobal('fetch', fetchMock)
      const res = await t.http().post(`${base()}/ai/enrich`).set('Cookie', owner.cookie).send({ draft: { ...BOOK('Dune'), coverUrl: null } }).expect(200)
      expect(res.body).toEqual({ provider: 'openai', enrichment: { categories: ['Science Fiction'], tags: ['desert'], description: 'A story.', language: 'en', isbn13: null, publisher: null, publishedYear: null, pages: null } })
      expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ Authorization: 'Bearer sk-secret-123' })
    })

    it('falls back to Home AI (direct Ollama) only when the admin allowed it', async () => {
      const draft = { ...BOOK('Dune'), coverUrl: null }
      const off = await t.http().post(`${base()}/ai/enrich`).set('Cookie', owner.cookie).send({ draft }).expect(409)
      expect(off.body.code).toBe('ai_not_configured')
      await t.db.prisma.library.update({ where: { id: lib }, data: { homeAiAllowed: true } })
      const fetchMock = vi.fn(async () => respond({ message: { content: '{"categories":[],"tags":["spice"],"description":"","language":"en"}' } }))
      vi.stubGlobal('fetch', fetchMock)
      const res = await t.http().post(`${base()}/ai/enrich`).set('Cookie', owner.cookie).send({ draft }).expect(200)
      expect(res.body).toMatchObject({ provider: 'home', enrichment: { tags: ['spice'] } })
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toBe('http://ollama.test:11434/api/chat')
      expect(JSON.parse(init.body as string)).toMatchObject({ think: false, stream: false, format: expect.any(Object) })
    })

    it('needs books.add or books.edit to enrich, and a vision provider to identify covers', async () => {
      const res = await t.http().post(`${base()}/ai/enrich`).set('Cookie', viewer.cookie).send({ draft: { ...BOOK('Dune'), coverUrl: null } }).expect(403)
      expect(res.body.permission).toBe('books.edit')
      const cover = await t.http().post(`${base()}/ai/identify-cover`).set('Cookie', viewer.cookie).send({ imageBase64: 'a'.repeat(200) }).expect(409)
      expect(cover.body.code).toBe('ai_not_configured')
    })

    it('validates usage against configured providers and clears usage when a provider is removed', async () => {
      await t.http().put(`${base()}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: 'gemini', vision: null }).expect(400)
      await t.http().put(`${base()}/ai/providers/openai_compatible`).set('Cookie', owner.cookie).send({ model: 'm', baseUrl: 'https://gw.test/v1', apiKey: 'k' }).expect(204)
      const noVision = await t.http().put(`${base()}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: null, vision: 'openai_compatible' }).expect(400)
      expect(noVision.body.code).toBe('no_vision')
      await t.http().put(`${base()}/ai/usage`).set('Cookie', owner.cookie).send({ enrich: 'openai_compatible', vision: null }).expect(204)
      await t.http().delete(`${base()}/ai/providers/openai_compatible`).set('Cookie', owner.cookie).expect(204)
      expect((await t.db.prisma.library.findUniqueOrThrow({ where: { id: lib } })).enrichProvider).toBeNull()
    })
  })

  describe('covers', () => {
    it('presigns a PUT under the library prefix for people who can add or edit books', async () => {
      const bookId = '44444444-0000-4000-8000-000000000001'
      const res = await t.http().post(`${base()}/covers/presign`).set('Cookie', owner.cookie).send({ bookId }).expect(201)
      expect(res.body.key).toMatch(new RegExp(`^${lib}/${bookId}-\\d+\\.jpg$`))
      expect(res.body.uploadUrl).toContain('https://s3.test.local/library-covers/')
      expect(res.body.uploadUrl).toContain('X-Amz-Signature=')
      expect(res.body.uploadUrl).not.toContain('x-amz-checksum')
      expect(res.body.publicUrl).toBe(`https://covers.test.local/${res.body.key}`)
      const denied = await t.http().post(`${base()}/covers/presign`).set('Cookie', viewer.cookie).send({ bookId }).expect(403)
      expect(denied.body.permission).toBe('books.edit')
    })
  })
})
