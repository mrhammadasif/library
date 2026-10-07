import type { IBook, IBookFields } from '~/models/IBook'
import type { IBookDraft, IEnrichment } from '~/models/IBookDraft'
import { isbn13To10, normalizeIsbn } from '~shared/isbn'

export function emptyFields(): IBookFields {
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
    coverPath: null,
    coverUrl: null,
    dominantColor: null,
    colorName: null,
    condition: null,
    notes: null,
  }
}

export function draftToFields(draft: IBookDraft): IBookFields {
  return {
    ...emptyFields(),
    isbn13: draft.isbn13,
    isbn10: draft.isbn10,
    title: draft.title,
    subtitle: draft.subtitle,
    authors: draft.authors,
    publisher: draft.publisher,
    publishedYear: draft.publishedYear,
    pages: draft.pages,
    language: draft.language,
    description: draft.description,
    categories: draft.categories,
    tags: draft.tags,
    coverUrl: draft.coverUrl,
  }
}

export function bookToFields(book: IBook): IBookFields {
  const { isbn13, isbn10, title, subtitle, authors, publisher, publishedYear, pages, language, description, categories,
    tags, coverPath, coverUrl, dominantColor, colorName, condition, notes } = book
  return { isbn13, isbn10, title, subtitle, authors, publisher, publishedYear, pages, language, description, categories,
    tags, coverPath, coverUrl, dominantColor, colorName, condition, notes }
}

export function fieldsToDraft(fields: IBookFields): IBookDraft {
  return {
    isbn13: fields.isbn13,
    isbn10: fields.isbn10,
    title: fields.title,
    subtitle: fields.subtitle,
    authors: fields.authors,
    publisher: fields.publisher,
    publishedYear: fields.publishedYear,
    pages: fields.pages,
    language: fields.language,
    description: fields.description,
    categories: fields.categories,
    tags: fields.tags,
    coverUrl: fields.coverUrl,
  }
}

/**
 * Merges AI suggestions into the form without overwriting anything the user typed (`touched`) or that the
 * lookup already filled: categories/tags are unioned, description/language only fill blanks.
 */
export function applyEnrichment(fields: IBookFields, enrichment: IEnrichment, touched: ReadonlySet<keyof IBookFields>): IBookFields {
  const union = (a: string[], b: string[], limit: number) => {
    const out = [...a]
    for (const v of b) {
      if (!out.some(x => x.toLowerCase() === v.toLowerCase())) {
        out.push(v)
      }
    }
    return out.slice(0, limit)
  }
  return {
    ...fields,
    categories: touched.has('categories') ? fields.categories : union(fields.categories, enrichment.categories, 6),
    tags: touched.has('tags') ? fields.tags : union(fields.tags, enrichment.tags, 10),
    description: touched.has('description') || fields.description ? fields.description : enrichment.description,
    language: touched.has('language') || fields.language ? fields.language : enrichment.language,
    // Facts the AI read in web results only fill blanks; anything typed or found in the book databases wins.
    isbn13: touched.has('isbn13') || fields.isbn13 ? fields.isbn13 : enrichment.isbn13,
    isbn10: touched.has('isbn13') || fields.isbn13 || !enrichment.isbn13 ? fields.isbn10 : isbn13To10(enrichment.isbn13),
    publisher: touched.has('publisher') || fields.publisher ? fields.publisher : enrichment.publisher,
    publishedYear: touched.has('publishedYear') || fields.publishedYear ? fields.publishedYear : enrichment.publishedYear,
    pages: touched.has('pages') || fields.pages ? fields.pages : enrichment.pages,
  }
}

/** Splits "a, b; c" into trimmed non-empty parts (author and tag inputs). */
export function splitList(text: string): string[] {
  return text.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
}

/** Fills a chosen search result's empty fields from the fuller per-ISBN record; tags/categories are unioned. */
export function fillBlanks(base: IBookDraft, extra: IBookDraft): IBookDraft {
  const pick = <K extends keyof IBookDraft>(key: K): IBookDraft[K] => {
    const value = base[key]
    const empty = value === null || value === '' || (Array.isArray(value) && value.length === 0)
    return empty ? extra[key] : value
  }
  const union = (a: string[], b: string[], limit: number) => [...a, ...b.filter(v => !a.some(x => x.toLowerCase() === v.toLowerCase()))].slice(0, limit)
  return {
    isbn13: pick('isbn13'),
    isbn10: pick('isbn10'),
    title: pick('title'),
    subtitle: pick('subtitle'),
    authors: pick('authors'),
    publisher: pick('publisher'),
    publishedYear: pick('publishedYear'),
    pages: pick('pages'),
    language: pick('language'),
    description: pick('description'),
    categories: union(base.categories, extra.categories, 6),
    tags: union(base.tags, extra.tags, 10),
    coverUrl: pick('coverUrl'),
  }
}

/**
 * Before saving: the ISBN box accepts ISBN-10s and hyphens, the book is stored with its ISBN-13 (and ISBN-10 when one
 * exists). Returns null when a typed ISBN is invalid, so the form can ask for a fix.
 */
export function withNormalizedIsbn(fields: IBookFields): IBookFields | null {
  if (!fields.isbn13) {
    return { ...fields, isbn13: null }
  }
  const isbn = normalizeIsbn(fields.isbn13)
  return isbn ? { ...fields, isbn13: isbn.isbn13, isbn10: isbn.isbn10 } : null
}
