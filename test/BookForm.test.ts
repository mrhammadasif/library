import type { IBookFields } from '~/models/IBook'
import { describe, expect, it } from 'vitest'
import { emptyDraft } from '../shared/metadata'
import { applyEnrichment, draftToFields, emptyFields, fieldsToDraft, splitList } from '~/utils/BookForm'

const enrichment = { categories: ['Science Fiction'], tags: ['desert', 'Politics'], description: 'AI summary', language: 'en' }

describe('bookForm', () => {
  it('fills blanks and unions lists', () => {
    const fields = { ...emptyFields(), title: 'Dune', tags: ['politics'] }
    const result = applyEnrichment(fields, enrichment, new Set())
    expect(result.tags).toEqual(['politics', 'desert'])
    expect(result.categories).toEqual(['Science Fiction'])
    expect(result.description).toBe('AI summary')
    expect(result.language).toBe('en')
  })

  it('never overwrites touched fields or existing descriptions', () => {
    const fields = { ...emptyFields(), title: 'Dune', tags: ['mine'], description: 'From Google' }
    const touched = new Set<keyof IBookFields>(['tags', 'language'])
    const result = applyEnrichment(fields, enrichment, touched)
    expect(result.tags).toEqual(['mine'])
    expect(result.description).toBe('From Google')
    expect(result.language).toBeNull()
  })

  it('round-trips drafts and fields', () => {
    const draft = { ...emptyDraft(), title: 'Dune', authors: ['Frank Herbert'], coverUrl: 'https://c' }
    expect(fieldsToDraft(draftToFields(draft))).toEqual(draft)
  })

  it('splits author/tag lists', () => {
    expect(splitList('a, b;c\n , ')).toEqual(['a', 'b', 'c'])
  })
})

describe('fillBlanks', () => {
  it('keeps what the chosen result has and fills the rest from the ISBN record', async () => {
    const { fillBlanks } = await import('~/utils/BookForm')
    const chosen = { ...emptyDraft(), title: 'Stories of the Prophets', authors: ['Ibn Kathir'], isbn13: '9781999802752', tags: ['stories'] }
    const record = { ...emptyDraft(), title: 'Stories Of The Prophets (Full Record)', publisher: 'Darussalam', pages: 512, publishedYear: 2003, categories: ['Islamic'], tags: ['islamic', 'Stories'] }
    expect(fillBlanks(chosen, record)).toMatchObject({
      title: 'Stories of the Prophets',
      authors: ['Ibn Kathir'],
      publisher: 'Darussalam',
      pages: 512,
      publishedYear: 2003,
      categories: ['Islamic'],
      tags: ['stories', 'islamic'],
    })
  })
})
