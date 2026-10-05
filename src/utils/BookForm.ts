import type { IBook, IBookFields } from '~/models/IBook'
import type { IBookDraft, IEnrichment } from '~/models/IBookDraft'

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
  }
}

/** Splits "a, b; c" into trimmed non-empty parts (author and tag inputs). */
export function splitList(text: string): string[] {
  return text.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
}
