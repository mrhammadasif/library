import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatJson } from '../shared/ai'
import { fetchGoogleByIsbn, fetchOpenLibraryByIsbn, searchCandidates } from '../shared/metadata'
import google from './fixtures/google-volumes.json'
import openLibrary from './fixtures/openlibrary-data.json'

function respond(body: unknown, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

const googleAccess = { apiKey: 'k', take: async () => true }

const config = { provider: 'openai_compatible' as const, model: 'm', baseUrl: 'https://gw.test/v1', apiKey: 'k' }
const request = { system: 's', user: 'u', schema: {}, timeoutMs: 1000 }

afterEach(() => vi.unstubAllGlobals())

describe('chatJson', () => {
  it('posts to chat/completions with a bearer key and parses the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ choices: [{ message: { content: '{"tags":["x"]}' } }] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(chatJson(config, { ...request, imageBase64: 'abc' })).resolves.toEqual({ tags: ['x'] })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://gw.test/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(init.body)
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,abc')
    expect(body.response_format.type).toBe('json_schema')
  })

  it('retries without response_format when the provider rejects it', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond('bad schema', 400))
      .mockResolvedValueOnce(respond({ choices: [{ message: { content: '{"ok":true}' } }] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(chatJson(config, request)).resolves.toEqual({ ok: true })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('response_format')
  })

  it('surfaces provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond('invalid key', 401)))
    await expect(chatJson(config, request)).rejects.toThrow('AI provider returned 401: invalid key')
  })
})

describe('metadata fetchers', () => {
  it('fetches by ISBN from both sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => respond(url.includes('openlibrary') ? openLibrary : google)))
    expect((await fetchOpenLibraryByIsbn('9780441172719'))?.publisher).toBe('Ace Books')
    expect((await fetchGoogleByIsbn('9780441172719', googleAccess))?.publisher).toBe('Penguin')
  })

  it('returns null on HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond('nope', 503)))
    expect(await fetchOpenLibraryByIsbn('9780441172719')).toBeNull()
  })

  it('searches both sources and tolerates one failing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('openlibrary')) {
        throw new Error('timeout')
      }
      return respond(google)
    }))
    const results = await searchCandidates('Dune', 'Herbert', googleAccess)
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Dune')
  })

  it('combines and dedupes candidates from both sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => respond(url.includes('openlibrary')
      ? { docs: [{ title: 'Dune', author_name: ['Frank Herbert'], isbn: ['9780441172719'] }, { title: 'Dune Messiah', author_name: ['Frank Herbert'] }] }
      : google)))
    const results = await searchCandidates('Dune', null, googleAccess)
    expect(results.map(r => r.title)).toEqual(['Dune', 'Dune Messiah'])
  })

  it('never calls Google without a key or when the daily budget is spent', async () => {
    const fetchMock = vi.fn(async (url: string) => respond(url.includes('openlibrary') ? { docs: [{ title: 'Dune', isbn: ['9780441172719'] }] } : google))
    vi.stubGlobal('fetch', fetchMock)
    const spent = { apiKey: 'k', take: vi.fn(async () => false) }
    expect(await fetchGoogleByIsbn('9780441172719', null)).toBeNull()
    expect(await fetchGoogleByIsbn('9780441172719', spent)).toBeNull()
    expect(await searchCandidates('Dune', null, spent)).toHaveLength(1)
    expect(await searchCandidates('Dune', null, null)).toHaveLength(1)
    expect(fetchMock.mock.calls.map(([url]) => url).filter(url => String(url).includes('googleapis'))).toEqual([])
    expect(spent.take).toHaveBeenCalledTimes(2)
  })

  it('adds the key to Google requests', async () => {
    const fetchMock = vi.fn(async () => respond({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchGoogleByIsbn('9780441172719', { apiKey: 'a b', take: async () => true })
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toBe('https://www.googleapis.com/books/v1/volumes?q=isbn:9780441172719&key=a%20b')
  })
})
