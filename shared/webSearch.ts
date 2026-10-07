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

// Small on purpose: every prompt token costs the library's own AI key time and money.
const MAX_RESULTS = 3
const MAX_SNIPPET = 200
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'from', 'book', 'books', 'edition'])

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
export async function searchWeb(
  baseUrl: string,
  query: string,
  { apiKey, timeoutMs = 8000, retryDelayMs = 1500 }: { apiKey?: string, timeoutMs?: number, retryDelayMs?: number } = {},
): Promise<IWebResult[]> {
  const first = await searchOnce(baseUrl, query, apiKey, timeoutMs)
  if (first.length || retryDelayMs < 0) {
    return first
  }
  await new Promise(resolve => setTimeout(resolve, retryDelayMs))
  return searchOnce(baseUrl, query, apiKey, timeoutMs)
}

/** Raw results (up to 20); `relevantResults` picks the few worth showing the AI. */
async function searchOnce(baseUrl: string, query: string, apiKey: string | undefined, timeoutMs: number): Promise<IWebResult[]> {
  const params = new URLSearchParams({ q: query, format: 'json', categories: 'general', safesearch: '1' })
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/search?${params}`, {
      // The home SearXNG is locked: API clients pass its key in this header.
      headers: { Accept: 'application/json', ...(apiKey ? { 'X-API-Key': apiKey } : {}) },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) {
      console.warn(`Web search returned ${response.status}`)
      return []
    }
    const data = await response.json() as ISearxngResponse
    return (data.results ?? [])
      .filter(r => r.title && r.url)
      .slice(0, 20)
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

function words(text: string): string[] {
  return text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOPWORDS.has(w))
}

/** Share of the title's meaningful words that appear in `text` (0–1); 0 for a title with none. */
export function titleScore(title: string, text: string): number {
  const titleWords = [...new Set(words(title))]
  if (!titleWords.length) {
    return 0
  }
  const found = new Set(words(text))
  return titleWords.filter(w => found.has(w)).length / titleWords.length
}

/**
 * The few results that are clearly about this book: most of its title words appear in the result, best match first.
 * Keeps the AI prompt short and stops ISBNs of other books from counting as evidence.
 */
export function relevantResults(draft: IBookDraft, results: IWebResult[]): IWebResult[] {
  return results
    .map(r => ({ r, score: titleScore(draft.title, `${r.title} ${r.snippet}`) }))
    .filter(x => x.score >= 0.75)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map(x => x.r)
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

// ─── Grounding: facts from the AI count only if the search results print them ─

function resultsText(results: IWebResult[]): string {
  return results.map(r => `${r.title} ${r.snippet}`).join(' \n ')
}

/** "2021" printed as a number of its own. */
export function yearInResults(year: number, results: IWebResult[]): boolean {
  return new RegExp(`(^|\\D)${year}(\\D|$)`).test(resultsText(results))
}

/** "64 pages", "64 p.", "pp. 64", "Pages: 64", "Print length: 64". */
export function pagesInResults(pages: number, results: IWebResult[]): boolean {
  const n = String(pages)
  return new RegExp(`(^|\\D)${n}\\s*(pages?|pp?\\.?)(\\W|$)|(pages?|pp\\.?|length)\\s*[:\\-]?\\s*${n}(\\D|$)`, 'i').test(resultsText(results))
}

const PUBLISHER_NOISE = /\b(books?|publish(ing|ers?)|press|house|inc|ltd|llc|limited|co|company|pvt|group|media)\b/gi

/** The publisher's distinctive name ("Goodword" of "Goodword Books") appears in the results, ignoring spacing/punctuation. */
export function publisherInResults(publisher: string, results: IWebResult[]): boolean {
  const squash = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '')
  const name = squash(publisher.replace(PUBLISHER_NOISE, ' '))
  return name.length >= 3 && squash(resultsText(results)).includes(name)
}
