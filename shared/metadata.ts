// Book metadata from Open Library and Google Books. Parsers and the merge are pure (unit-tested with fixtures);
// the fetchers are thin wrappers.

/** A pre-filled book form. Field names match the app's IBookDraft. */
export interface IBookDraft {
  isbn13: string | null
  isbn10: string | null
  title: string
  subtitle: string | null
  authors: string[]
  publisher: string | null
  publishedYear: number | null
  pages: number | null
  language: string | null
  description: string | null
  categories: string[]
  tags: string[]
  coverUrl: string | null
}

export function emptyDraft(): IBookDraft {
  return {
    isbn13: null,
    isbn10: null,
    title: '',
    subtitle: null,
    authors: [],
    publisher: null,
    publishedYear: null,
    pages: null,
    language: null,
    description: null,
    categories: [],
    tags: [],
    coverUrl: null,
  }
}

const LANGUAGES: Record<string, string> = {
  eng: 'en', urd: 'ur', ara: 'ar', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', spa: 'es', ita: 'it', por: 'pt',
  rus: 'ru', chi: 'zh', zho: 'zh', jpn: 'ja', hin: 'hi', per: 'fa', fas: 'fa', tur: 'tr', pan: 'pa', ben: 'bn',
}

/** ISO 639-2 ("eng", "/languages/eng") → ISO 639-1 ("en"); two-letter codes pass through. */
export function toLanguageCode(raw: string | null | undefined): string | null {
  if (!raw) {
    return null
  }
  const code = raw.split('/').pop()!.toLowerCase()
  if (code.length === 2) {
    return code
  }
  return LANGUAGES[code] ?? null
}

export function parseYear(raw: string | number | null | undefined): number | null {
  // No \b: catalogue dates like "c1965" glue the year to a letter.
  const match = String(raw ?? '').match(/(?<!\d)(\d{4})(?!\d)/)
  return match ? Number(match[1]) : null
}

function clean(text: string | null | undefined): string | null {
  const value = (text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return value || null
}

function uniq(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const v = value.trim()
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase())
      out.push(v)
    }
  }
  return out.slice(0, limit)
}

// ─── Open Library ───────────────────────────────────────────────────────────

interface IOpenLibraryData {
  title?: string
  subtitle?: string
  authors?: { name: string }[]
  publishers?: { name: string }[]
  publish_date?: string
  number_of_pages?: number
  subjects?: { name: string }[]
  cover?: { small?: string, medium?: string, large?: string }
  identifiers?: { isbn_13?: string[], isbn_10?: string[] }
  notes?: string | { value: string }
  excerpts?: { text: string }[]
  languages?: { key: string }[]
}

/** Parses one entry of /api/books?bibkeys=ISBN:…&jscmd=data. */
export function parseOpenLibraryData(data: IOpenLibraryData | undefined): IBookDraft | null {
  if (!data?.title) {
    return null
  }
  const notes = typeof data.notes === 'string' ? data.notes : data.notes?.value
  return {
    ...emptyDraft(),
    isbn13: data.identifiers?.isbn_13?.[0] ?? null,
    isbn10: data.identifiers?.isbn_10?.[0] ?? null,
    title: data.title.trim(),
    subtitle: clean(data.subtitle),
    authors: uniq((data.authors ?? []).map(a => a.name), 10),
    publisher: data.publishers?.[0]?.name ?? null,
    publishedYear: parseYear(data.publish_date),
    pages: data.number_of_pages ?? null,
    language: toLanguageCode(data.languages?.[0]?.key),
    description: clean(notes),
    categories: uniq((data.subjects ?? []).map(s => s.name).filter(s => s.length <= 40), 6),
    coverUrl: data.cover?.large ?? data.cover?.medium ?? null,
  }
}

interface IOpenLibraryDoc {
  title?: string
  subtitle?: string
  author_name?: string[]
  isbn?: string[]
  publisher?: string[]
  first_publish_year?: number
  number_of_pages_median?: number
  language?: string[]
  subject?: string[]
  cover_i?: number
}

/** Parses one doc of /search.json. */
export function parseOpenLibraryDoc(doc: IOpenLibraryDoc): IBookDraft | null {
  if (!doc.title) {
    return null
  }
  const isbn13 = doc.isbn?.find(i => i.length === 13) ?? null
  return {
    ...emptyDraft(),
    isbn13,
    isbn10: doc.isbn?.find(i => i.length === 10) ?? null,
    title: doc.title.trim(),
    subtitle: clean(doc.subtitle),
    authors: uniq(doc.author_name ?? [], 10),
    publisher: doc.publisher?.[0] ?? null,
    publishedYear: doc.first_publish_year ?? null,
    pages: doc.number_of_pages_median ?? null,
    language: toLanguageCode(doc.language?.[0]),
    categories: uniq((doc.subject ?? []).filter(s => s.length <= 40), 6),
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
  }
}

// ─── Google Books ───────────────────────────────────────────────────────────

interface IGoogleVolume {
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    categories?: string[]
    language?: string
    industryIdentifiers?: { type: string, identifier: string }[]
    imageLinks?: { thumbnail?: string, smallThumbnail?: string }
  }
}

/** Google thumbnails are http and tiny by default; ask for https and a larger zoom without the page curl. */
export function upgradeGoogleCover(url: string | undefined): string | null {
  if (!url) {
    return null
  }
  return url.replace(/^http:/, 'https:').replace(/&edge=curl/, '').replace(/zoom=\d/, 'zoom=1')
}

export function parseGoogleVolume(volume: IGoogleVolume | undefined): IBookDraft | null {
  const info = volume?.volumeInfo
  if (!info?.title) {
    return null
  }
  const ids = info.industryIdentifiers ?? []
  return {
    ...emptyDraft(),
    isbn13: ids.find(i => i.type === 'ISBN_13')?.identifier ?? null,
    isbn10: ids.find(i => i.type === 'ISBN_10')?.identifier ?? null,
    title: info.title.trim(),
    subtitle: clean(info.subtitle),
    authors: uniq(info.authors ?? [], 10),
    publisher: info.publisher ?? null,
    publishedYear: parseYear(info.publishedDate),
    pages: info.pageCount || null,
    language: toLanguageCode(info.language),
    description: clean(info.description),
    // "Fiction / Science Fiction / General" → "Science Fiction"
    categories: uniq((info.categories ?? []).flatMap(c => c.split('/').map(s => s.trim()).filter(s => s && s !== 'General')), 6),
    coverUrl: upgradeGoogleCover(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail),
  }
}

// ─── Merge ──────────────────────────────────────────────────────────────────

/**
 * Field-by-field merge, first non-empty source wins. Callers pass Open Library first for bibliographic fields;
 * descriptions and categories prefer Google Books, which has richer ones.
 */
export function mergeDrafts(openLibrary: IBookDraft | null, google: IBookDraft | null): IBookDraft | null {
  const sources = [openLibrary, google].filter((d): d is IBookDraft => d !== null)
  if (sources.length === 0) {
    return null
  }
  const first = <K extends keyof IBookDraft>(key: K, order = sources): IBookDraft[K] => {
    for (const source of order) {
      const value = source[key]
      if (Array.isArray(value) ? value.length > 0 : value !== null && value !== '') {
        return value
      }
    }
    return sources[0][key]
  }
  const googleFirst = [...sources].reverse()
  return {
    isbn13: first('isbn13'),
    isbn10: first('isbn10'),
    title: first('title'),
    subtitle: first('subtitle'),
    authors: first('authors'),
    publisher: first('publisher'),
    publishedYear: first('publishedYear'),
    pages: first('pages'),
    language: first('language', googleFirst),
    description: first('description', googleFirst),
    categories: first('categories', googleFirst),
    tags: [],
    coverUrl: first('coverUrl'),
  }
}

// ─── Fetchers ───────────────────────────────────────────────────────────────

const TIMEOUT_MS = 8000

async function getJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'HomeLibrary/1.0' } })
  if (!response.ok) {
    return null
  }
  return await response.json() as T
}

function googleKey(apiKey?: string): string {
  return apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''
}

export async function fetchOpenLibraryByIsbn(isbn13: string): Promise<IBookDraft | null> {
  const key = `ISBN:${isbn13}`
  const data = await getJson<Record<string, IOpenLibraryData>>(
    `https://openlibrary.org/api/books?bibkeys=${key}&jscmd=data&format=json`,
  )
  return parseOpenLibraryData(data?.[key])
}

export async function fetchGoogleByIsbn(isbn13: string, apiKey?: string): Promise<IBookDraft | null> {
  const data = await getJson<{ items?: IGoogleVolume[] }>(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}${googleKey(apiKey)}`,
  )
  return parseGoogleVolume(data?.items?.[0])
}

/** Free-text candidates (title/author), Google Books first, de-duplicated by ISBN or title+author. */
export async function searchCandidates(title: string, author: string | null, apiKey?: string): Promise<IBookDraft[]> {
  const q = [`intitle:${title}`, author ? `inauthor:${author}` : ''].filter(Boolean).join('+')
  const olParams = new URLSearchParams({ title, limit: '5', fields: 'title,subtitle,author_name,isbn,publisher,first_publish_year,number_of_pages_median,language,subject,cover_i' })
  if (author) {
    olParams.set('author', author)
  }
  const [google, openLibrary] = await Promise.allSettled([
    getJson<{ items?: IGoogleVolume[] }>(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5${googleKey(apiKey)}`,
    ),
    getJson<{ docs?: IOpenLibraryDoc[] }>(`https://openlibrary.org/search.json?${olParams}`),
  ])
  const drafts = [
    ...(google.status === 'fulfilled' ? google.value?.items ?? [] : []).map(parseGoogleVolume),
    ...(openLibrary.status === 'fulfilled' ? openLibrary.value?.docs ?? [] : []).map(parseOpenLibraryDoc),
  ].filter((d): d is IBookDraft => d !== null)
  return dedupeCandidates(drafts).slice(0, 8)
}

export function dedupeCandidates(drafts: IBookDraft[]): IBookDraft[] {
  const seen = new Set<string>()
  return drafts.filter((d) => {
    const key = d.isbn13 ?? `${d.title.toLowerCase()}|${(d.authors[0] ?? '').toLowerCase()}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}
