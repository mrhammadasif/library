// Web search (self-hosted SearXNG, JSON output) used to give the AI something real to read about a book that the
// book databases know little about. Pure fetch + parsing; no framework imports.
import type { IBookDraft } from './metadata.ts'
import { normalizeIsbn } from './isbn.ts'

export interface IWebResult {
  title: string
  url: string
  snippet: string
}

interface ISearxngResponse {
  results?: { title?: string, url?: string, content?: string }[]
}

const MAX_RESULTS = 6
const MAX_SNIPPET = 300

/** Web search worth doing only when the book databases left something out. */
export function needsWebSearch(draft: IBookDraft): boolean {
  return !draft.title.trim()
    ? false
    : !draft.isbn13 || !draft.publisher || !draft.publishedYear || !draft.pages || !draft.description || !draft.categories.length
}

/** `"Stories of the Prophets" Ibn Kathir book isbn` */
export function bookQuery(draft: IBookDraft): string {
  return [`"${draft.title.trim()}"`, draft.authors[0] ?? '', 'book isbn'].filter(Boolean).join(' ')
}

/**
 * GET {baseUrl}/search?format=json (SearXNG needs `json` in `search.formats`). Its upstream engines get rate-limited
 * now and then and answer with nothing, so an empty answer is retried once after a short pause. Errors give [].
 */
export async function searchWeb(baseUrl: string, query: string, { timeoutMs = 8000, retryDelayMs = 1500 } = {}): Promise<IWebResult[]> {
  const first = await searchOnce(baseUrl, query, timeoutMs)
  if (first.length || retryDelayMs < 0) {
    return first
  }
  await new Promise(resolve => setTimeout(resolve, retryDelayMs))
  return searchOnce(baseUrl, query, timeoutMs)
}

async function searchOnce(baseUrl: string, query: string, timeoutMs: number): Promise<IWebResult[]> {
  const params = new URLSearchParams({ q: query, format: 'json', categories: 'general', safesearch: '1' })
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/search?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      console.warn(`Web search returned ${response.status}`)
      return []
    }
    const data = await response.json() as ISearxngResponse
    return (data.results ?? [])
      .filter(r => r.title && r.url)
      .slice(0, MAX_RESULTS)
      .map(r => ({
        title: r.title!.trim().slice(0, 200),
        url: r.url!,
        snippet: (r.content ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET),
      }))
  }
  catch (error) {
    console.warn(`Web search failed: ${(error as Error).message}`)
    return []
  }
}

/** Every valid ISBN printed in the results, as ISBN-13. The AI may only pick an ISBN from this set. */
export function isbnsInResults(results: IWebResult[]): Set<string> {
  const found = new Set<string>()
  const pattern = /(?:97[89][-\s]?)?\d(?:[-\s]?\d){8}[-\s]?[\dXx]/g
  for (const r of results) {
    for (const match of `${r.title} ${r.snippet} ${r.url}`.matchAll(pattern)) {
      const isbn = normalizeIsbn(match[0])
      if (isbn) {
        found.add(isbn.isbn13)
      }
    }
  }
  return found
}
