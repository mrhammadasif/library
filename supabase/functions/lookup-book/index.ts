// POST { libraryId, isbn?, title?, author? } → { draft, candidates, sources, existingCopies }
// ISBN: Open Library + Google Books in parallel, merged. Title/author: free-text candidates. No AI here, so the
// review form opens fast; the app calls enrich-book afterwards.
import { HttpError, json, memberContext, serve } from '../_shared/http.ts'
import { normalizeIsbn } from '../../../shared/isbn.ts'
import { fetchGoogleByIsbn, fetchOpenLibraryByIsbn, mergeDrafts, searchCandidates } from '../../../shared/metadata.ts'

const GOOGLE_KEY = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? undefined

serve(async (req, body) => {
  const { admin } = await memberContext(req, body.libraryId)
  const libraryId = body.libraryId as string

  if (typeof body.isbn === 'string' && body.isbn.trim()) {
    const isbn = normalizeIsbn(body.isbn)
    if (!isbn) {
      throw new HttpError(400, 'invalid_isbn', 'That doesn\'t look like a valid ISBN')
    }
    const [openLibrary, google] = await Promise.allSettled([
      fetchOpenLibraryByIsbn(isbn.isbn13),
      fetchGoogleByIsbn(isbn.isbn13, GOOGLE_KEY),
    ])
    const ol = openLibrary.status === 'fulfilled' ? openLibrary.value : null
    const gb = google.status === 'fulfilled' ? google.value : null
    const merged = mergeDrafts(ol, gb)
    const draft = merged ? { ...merged, isbn13: isbn.isbn13, isbn10: isbn.isbn10 } : null
    const { data: existing } = await admin.from('books').select('id, title, status, shelf_id')
      .eq('library_id', libraryId).eq('isbn13', isbn.isbn13).neq('status', 'archived')
    return json({
      draft,
      candidates: [],
      sources: { openLibrary: ol !== null, googleBooks: gb !== null },
      isbn,
      existingCopies: existing ?? [],
    })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    throw new HttpError(400, 'bad_request', 'Provide an ISBN or a title')
  }
  const author = typeof body.author === 'string' && body.author.trim() ? body.author.trim() : null
  const candidates = await searchCandidates(title, author, GOOGLE_KEY)
  return json({ draft: null, candidates, sources: {}, isbn: null, existingCopies: [] })
})
