import { describe, expect, it } from 'vitest'
import { cleanIsbn, isbn10To13, isbn13To10, isValidIsbn10, isValidIsbn13, normalizeIsbn } from '../shared/isbn'

describe('isbn', () => {
  it('cleans dashes and spaces', () => {
    expect(cleanIsbn('978-0-441-17271-9')).toBe('9780441172719')
    expect(cleanIsbn(' 0-8044-2957-x ')).toBe('080442957X')
  })

  it('validates ISBN-13 checksums and prefixes', () => {
    expect(isValidIsbn13('9780441172719')).toBe(true)
    expect(isValidIsbn13('9780441172710')).toBe(false)
    expect(isValidIsbn13('1234567890128')).toBe(false)
  })

  it('validates ISBN-10 including the X check digit', () => {
    expect(isValidIsbn10('0441172717')).toBe(true)
    expect(isValidIsbn10('080442957X')).toBe(true)
    expect(isValidIsbn10('0441172718')).toBe(false)
  })

  it('converts between 10 and 13', () => {
    expect(isbn10To13('0441172717')).toBe('9780441172719')
    expect(isbn13To10('9780441172719')).toBe('0441172717')
    expect(isbn13To10('9798886451740')).toBeNull()
  })

  it('normalizes either form or rejects junk', () => {
    expect(normalizeIsbn('0441172717')).toEqual({ isbn13: '9780441172719', isbn10: '0441172717' })
    expect(normalizeIsbn('978-0-441-17271-9')).toEqual({ isbn13: '9780441172719', isbn10: '0441172717' })
    expect(normalizeIsbn('5012345678900')).toBeNull()
    expect(normalizeIsbn('hello')).toBeNull()
  })
})
