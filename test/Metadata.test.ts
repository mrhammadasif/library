import { describe, expect, it } from 'vitest'
import {
  dedupeCandidates,
  emptyDraft,
  mergeDrafts,
  parseGoogleVolume,
  parseOpenLibraryData,
  parseOpenLibraryDoc,
  parseYear,
  toLanguageCode,
  upgradeGoogleCover,
} from '../shared/metadata'
import google from './fixtures/google-volumes.json'
import openLibrary from './fixtures/openlibrary-data.json'

const ol = parseOpenLibraryData(openLibrary['ISBN:9780441172719'])!
const gb = parseGoogleVolume(google.items[0])!

describe('metadata', () => {
  it('parses Open Library data', () => {
    expect(ol.title).toBe('Dune')
    expect(ol.authors).toEqual(['Frank Herbert'])
    expect(ol.publishedYear).toBe(2005)
    expect(ol.pages).toBe(528)
    expect(ol.language).toBe('en')
    expect(ol.coverUrl).toBe('https://covers.openlibrary.org/b/id/1-L.jpg')
    expect(ol.categories).toEqual(['Science fiction', 'Deserts'])
  })

  it('parses Google Books volumes, stripping HTML and splitting category paths', () => {
    expect(gb.description).toBe('Set on the desert planet Arrakis , Dune is the story of Paul Atreides.')
    expect(gb.categories).toEqual(['Fiction', 'Science Fiction'])
    expect(gb.subtitle).toBeNull()
    expect(gb.pages).toBeNull()
    expect(gb.coverUrl).toBe('https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1&source=gbs_api')
  })

  it('returns null for responses without a title', () => {
    expect(parseOpenLibraryData(undefined)).toBeNull()
    expect(parseGoogleVolume({ volumeInfo: {} })).toBeNull()
    expect(parseOpenLibraryDoc({})).toBeNull()
  })

  it('merges with Open Library first for bibliographic fields and Google first for descriptions', () => {
    const merged = mergeDrafts(ol, gb)!
    expect(merged.publisher).toBe('Ace Books')
    expect(merged.pages).toBe(528)
    expect(merged.description).toContain('Arrakis')
    expect(merged.categories).toEqual(['Fiction', 'Science Fiction'])
    expect(merged.coverUrl).toBe(ol.coverUrl)
  })

  it('merges a single source and handles none', () => {
    expect(mergeDrafts(null, gb)!.title).toBe('Dune')
    expect(mergeDrafts(null, null)).toBeNull()
  })

  it('parses search docs', () => {
    const doc = parseOpenLibraryDoc({ title: 'Dune', author_name: ['Frank Herbert'], isbn: ['0441172717', '9780441172719'], cover_i: 42, language: ['eng'] })!
    expect(doc.isbn13).toBe('9780441172719')
    expect(doc.isbn10).toBe('0441172717')
    expect(doc.coverUrl).toBe('https://covers.openlibrary.org/b/id/42-L.jpg')
    expect(doc.language).toBe('en')
  })

  it('dedupes candidates by ISBN or title+author', () => {
    const a = { ...emptyDraft(), title: 'Dune', authors: ['Frank Herbert'], isbn13: '9780441172719' }
    const b = { ...emptyDraft(), title: 'Dune', authors: ['Frank Herbert'], isbn13: '9780441172719' }
    const c = { ...emptyDraft(), title: 'dune', authors: ['frank herbert'] }
    const d = { ...emptyDraft(), title: 'Dune', authors: ['Frank Herbert'] }
    expect(dedupeCandidates([a, b, c, d])).toHaveLength(2)
  })

  it('parses years and language codes', () => {
    expect(parseYear('c1965, reprinted 2005')).toBe(1965)
    expect(parseYear(null)).toBeNull()
    expect(toLanguageCode('/languages/urd')).toBe('ur')
    expect(toLanguageCode('xyz')).toBeNull()
    expect(toLanguageCode(null)).toBeNull()
    expect(upgradeGoogleCover(undefined)).toBeNull()
  })
})
