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

  it('accepts web facts only when they check out', () => {
    const reply = { categories: ['Islamic'], tags: ['children'], description: 'Stories.', language: 'en', isbn: '978-1-999802-75-2', publisher: ' Watson ', year: '2021', pages: 64 }
    // ISBN printed in a search result → kept; same reply without that grounding → dropped.
    expect(parseEnrichment(reply, new Set(['9781999802752']))).toMatchObject({ isbn13: '9781999802752', publisher: 'Watson', publishedYear: 2021, pages: 64 })
    expect(parseEnrichment(reply).isbn13).toBeNull()
    expect(parseEnrichment({ ...reply, isbn: '9781999802753' }, new Set(['9781999802753', '9780441172719'])).isbn13).toBeNull()
    // The AI named nothing usable, but the results print exactly one ISBN: that one is unambiguous.
    expect(parseEnrichment({ ...reply, isbn: null }, new Set(['9781999802752'])).isbn13).toBe('9781999802752')
    expect(parseEnrichment({ ...reply, isbn: null }, new Set(['9781999802752', '9780441172719'])).isbn13).toBeNull()
    expect(parseEnrichment({ ...reply, year: 3000, pages: 0 })).toMatchObject({ publishedYear: null, pages: null })
    // Models sometimes write "null" as text.
    expect(parseEnrichment({ ...reply, publisher: 'null' }).publisher).toBeNull()
    expect(parseEnrichment({ ...reply, publisher: 'Unknown' }).publisher).toBeNull()
    expect(parseEnrichment({ ...reply, year: 2001.5, pages: '12 pages' })).toMatchObject({ publishedYear: null, pages: null })
  })

  it('adds web results to the enrichment prompt only when there are some', () => {
    const draft = { ...emptyDraft(), title: 'Dune' }
    expect(JSON.parse(buildEnrichUser(draft))).not.toHaveProperty('web')
    const user = JSON.parse(buildEnrichUser(draft, [{ title: 'Dune - Ace', url: 'https://x', snippet: 'ISBN 9780441172719' }]))
    expect(user.web).toEqual([{ title: 'Dune - Ace', snippet: 'ISBN 9780441172719' }])
  })
})
