// TEST DATA ONLY: SearXNG-shaped responses.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyDraft } from '../shared/metadata'
import { bookQuery, isbnsInResults, needsWebSearch, searchWeb } from '../shared/webSearch'

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

describe('webSearch', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('searches only when the book databases left gaps', () => {
    const full = { ...emptyDraft(), title: 'Dune', isbn13: '9780441172719', publisher: 'Ace', publishedYear: 1990, pages: 535, description: 'Spice.', categories: ['Fiction'] }
    expect(needsWebSearch(full)).toBe(false)
    expect(needsWebSearch({ ...full, pages: null })).toBe(true)
    expect(needsWebSearch({ ...emptyDraft(), title: '  ' })).toBe(false)
  })

  it('quotes the title and adds the first author', () => {
    expect(bookQuery({ ...emptyDraft(), title: ' Stories of the Prophets ', authors: ['Ibn Kathir', 'X'] })).toBe('"Stories of the Prophets" Ibn Kathir book isbn')
    expect(bookQuery({ ...emptyDraft(), title: 'Dune' })).toBe('"Dune" book isbn')
  })

  it('calls SearXNG for JSON and trims results', async () => {
    const fetchMock = vi.fn(async () => respond({ results: [
      { title: ' Dune ', url: 'https://a', content: 'ISBN   978-0-441-17271-9\n Ace, 1990' },
      { title: 'no url' },
      ...Array.from({ length: 10 }, (_, i) => ({ title: `r${i}`, url: `https://r${i}`, content: 'x'.repeat(500) })),
    ] }))
    vi.stubGlobal('fetch', fetchMock)
    const results = await searchWeb('http://searxng:8080/', '"Dune" book isbn')
    expect(results).toHaveLength(6)
    expect(results[0]).toEqual({ title: 'Dune', url: 'https://a', snippet: 'ISBN 978-0-441-17271-9 Ace, 1990' })
    expect(results[1].snippet).toHaveLength(300)
    const url = new URL(String((fetchMock.mock.calls[0] as unknown as [string])[0]))
    expect(url.origin + url.pathname).toBe('http://searxng:8080/search')
    expect(url.searchParams.get('format')).toBe('json')
    expect(url.searchParams.get('q')).toBe('"Dune" book isbn')
  })

  it('retries once when rate-limited engines return nothing, and gives up quietly on errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respond({ results: [] }))
      .mockResolvedValueOnce(respond({ results: [{ title: 'Dune', url: 'https://a', content: '' }] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchWeb('http://s', 'q', { retryDelayMs: 0 })).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => respond({}, 502)))
    expect(await searchWeb('http://s', 'q', { retryDelayMs: -1 })).toEqual([])
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('timeout') }))
    expect(await searchWeb('http://s', 'q', { retryDelayMs: 0 })).toEqual([])
  })

  it('finds valid ISBNs in any form and ignores look-alikes', () => {
    const found = isbnsInResults([
      { title: 'Dune (ISBN 978-0-441-17271-9)', url: 'https://x/0441172717', snippet: 'Phone 0300 1234567 · 9781999802753 · 978 1 999802 75 2' },
    ])
    expect([...found].sort()).toEqual(['9780441172719', '9781999802752'])
  })
})
