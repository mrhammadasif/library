// TEST DATA ONLY: SearXNG-shaped responses.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyDraft } from '../shared/metadata'
import { bookQuery, isbnsInResults, needsWebSearch, relevantResults, searchWeb } from '../shared/webSearch'

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
    const results = await searchWeb('https://searxng.test/', '"Dune" book isbn', { apiKey: 'sx-key' })
    expect(results).toHaveLength(11)
    expect(results[0]).toEqual({ title: 'Dune', url: 'https://a', snippet: 'ISBN 978-0-441-17271-9 Ace, 1990' })
    expect(results[1].snippet).toHaveLength(200)
    const [requested, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.headers).toMatchObject({ 'X-API-Key': 'sx-key' })
    const url = new URL(String(requested))
    expect(url.origin + url.pathname).toBe('https://searxng.test/search')
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

  it('keeps only the few results about this book, best match first', () => {
    const draft = { ...emptyDraft(), title: 'Stories from the Battles of the Prophet Muhammad' }
    const r = (title: string, snippet = '') => ({ title, url: `https://${title.length}`, snippet })
    const results = [
      r('Stories of the Prophets for Kids'),
      r('Stories from the Battles of the Prophet Muhammad - Amazon.in', 'ISBN-10 1999802756'),
      r('Battles of the Prophet', 'Stories retold, Muhammad'),
      r('Prophet Muhammad stories', 'from the battles: 9781999802752'),
      r('Stories from the Battles of the Prophet Muhammad, Paperback'),
    ]
    expect(relevantResults(draft, results).map(x => x.title)).toEqual([
      'Stories from the Battles of the Prophet Muhammad - Amazon.in',
      'Battles of the Prophet',
      'Prophet Muhammad stories',
    ])
    expect(relevantResults({ ...emptyDraft(), title: 'The' }, results)).toEqual([])
  })
})
