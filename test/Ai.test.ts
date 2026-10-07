import { describe, expect, it } from 'vitest'
import { baseUrlFor, buildEnrichUser, extractJson, parseEnrichment, parseIdentification } from '../shared/ai'
import { emptyDraft } from '../shared/metadata'

describe('ai', () => {
  it('extracts JSON from replies with think blocks and code fences', () => {
    expect(extractJson('<think>hmm {not json}</think>\n```json\n{"a": 1}\n```')).toEqual({ a: 1 })
    expect(extractJson('Sure! {"tags": ["x"]} Hope that helps')).toEqual({ tags: ['x'] })
    expect(() => extractJson('no json here')).toThrow('no JSON')
  })

  it('validates enrichment replies and drops junk', () => {
    const parsed = parseEnrichment({
      categories: ['Science Fiction', 'Science Fiction', 42, 'Classics', 'Adventure', 'Extra'],
      tags: ['#Desert', 'politics', 'a'.repeat(50)],
      description: '  A story.  ',
      language: 'EN',
    })
    expect(parsed).toEqual({
      categories: ['Science Fiction', 'Classics', 'Adventure'],
      tags: ['desert', 'politics'],
      description: 'A story.',
      language: 'en',
      isbn13: null, publisher: null, publishedYear: null, pages: null,
    })
    expect(parseEnrichment(null)).toEqual({ categories: [], tags: [], description: null, language: null, isbn13: null, publisher: null, publishedYear: null, pages: null })
    expect(parseEnrichment({ language: 'english' }).language).toBeNull()
  })

  it('validates identification replies and clamps confidence', () => {
    expect(parseIdentification({ title: ' Dune ', authors: ['Frank Herbert'], isbn: '', confidence: 3 })).toEqual({
      title: 'Dune',
      subtitle: null,
      authors: ['Frank Herbert'],
      isbn: null,
      publisher: null,
      confidence: 1,
    })
    expect(parseIdentification('nonsense').title).toBe('')
  })

  it('builds the enrichment prompt from the draft without the cover', () => {
    const user = JSON.parse(buildEnrichUser({ ...emptyDraft(), title: 'Dune', authors: ['Frank Herbert'], coverUrl: 'https://x' }))
    expect(user.title).toBe('Dune')
    expect(user).not.toHaveProperty('coverUrl')
  })

  it('resolves base URLs per provider', () => {
    expect(baseUrlFor({ provider: 'openai', model: 'm', baseUrl: null, apiKey: 'k' })).toBe('https://api.openai.com/v1')
    expect(baseUrlFor({ provider: 'gemini', model: 'm', baseUrl: null, apiKey: 'k' })).toContain('generativelanguage')
    expect(baseUrlFor({ provider: 'openai_compatible', model: 'm', baseUrl: 'https://gw/v1', apiKey: 'k' })).toBe('https://gw/v1')
  })

  it('accepts web facts only when the search results print them', () => {
    const reply = { categories: ['Islamic'], tags: ['children'], description: 'Stories.', language: 'en', isbn: '978-1-999802-75-2', publisher: ' Watson ', year: '2021', pages: 64 }
    const web = [{ title: 'Stories from the Battles of the Prophet Muhammad', url: 'https://x', snippet: 'Watson Publishing, 2021 · 64 pages · ISBN 978-1-999802-75-2' }]
    expect(parseEnrichment(reply, web)).toMatchObject({ isbn13: '9781999802752', publisher: 'Watson', publishedYear: 2021, pages: 64 })
    // Nothing printed → nothing kept, however plausible.
    expect(parseEnrichment(reply)).toMatchObject({ isbn13: null, publisher: null, publishedYear: null, pages: null })
    // Invented values: an ISBN, year and page count the results don't print.
    expect(parseEnrichment({ ...reply, isbn: '9780441172719', year: 1900, pages: 1900 }, web)).toMatchObject({ isbn13: '9781999802752', publishedYear: null, pages: null })
    // The AI named no ISBN, but the results print exactly one: that one is unambiguous. Two → no guess.
    expect(parseEnrichment({ ...reply, isbn: null }, web).isbn13).toBe('9781999802752')
    const two = [...web, { title: 'Dune', url: 'https://y', snippet: 'ISBN 9780441172719' }]
    expect(parseEnrichment({ ...reply, isbn: null }, two).isbn13).toBeNull()
    // Out of range, not whole numbers, "null" as text.
    expect(parseEnrichment({ ...reply, year: 3000, pages: 0 }, web)).toMatchObject({ publishedYear: null, pages: null })
    expect(parseEnrichment({ ...reply, year: 2001.5, pages: '12 pages' }, web)).toMatchObject({ publishedYear: null, pages: null })
    expect(parseEnrichment({ ...reply, publisher: 'null' }, web).publisher).toBeNull()
  })

  it('adds web results to the enrichment prompt only when there are some', () => {
    const draft = { ...emptyDraft(), title: 'Dune' }
    expect(JSON.parse(buildEnrichUser(draft))).not.toHaveProperty('web')
    const user = JSON.parse(buildEnrichUser(draft, [{ title: 'Dune - Ace', url: 'https://x', snippet: 'ISBN 9780441172719' }]))
    expect(user.web).toEqual([{ title: 'Dune - Ace', snippet: 'ISBN 9780441172719' }])
  })
})
