// ISBN helpers shared by the edge functions and the app (imported there as ~fn/isbn). Pure; no imports.

/** Keeps digits and a trailing X: "978-0-441-17271-9" → "9780441172719". */
export function cleanIsbn(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9X]/g, '')
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) {
    return false
  }
  const sum = [...isbn].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0)
  return sum % 10 === 0
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) {
    return false
  }
  const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0)
  return sum % 11 === 0
}

export function isbn10To13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`
  const sum = [...core].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0)
  return `${core}${(10 - (sum % 10)) % 10}`
}

/** Only 978-prefixed ISBN-13s have an ISBN-10 form. */
export function isbn13To10(isbn13: string): string | null {
  if (!isbn13.startsWith('978')) {
    return null
  }
  const core = isbn13.slice(3, 12)
  const sum = [...core].reduce((acc, ch, i) => acc + Number(ch) * (10 - i), 0)
  const check = (11 - (sum % 11)) % 11
  return `${core}${check === 10 ? 'X' : check}`
}

/** Validates either form and returns both, or null when the input isn't a valid ISBN. */
export function normalizeIsbn(raw: string): { isbn13: string, isbn10: string | null } | null {
  const isbn = cleanIsbn(raw)
  if (isValidIsbn13(isbn)) {
    return { isbn13: isbn, isbn10: isbn13To10(isbn) }
  }
  if (isValidIsbn10(isbn)) {
    return { isbn13: isbn10To13(isbn), isbn10: isbn }
  }
  return null
}
