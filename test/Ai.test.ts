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
    })
    expect(parseEnrichment(null)).toEqual({ categories: [], tags: [], description: null, language: null })
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
})
