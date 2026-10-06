// POST { libraryId, imageBase64 } → { identification, candidates } using the library's vision provider
// (OpenAI / Gemini). 409 ai_not_configured when none is set up, so the app can fall back to ISBN scanning.
import { chatJson, IDENTIFY_SCHEMA, IDENTIFY_SYSTEM, parseIdentification } from '../../../shared/ai.ts'
import { aiConfig, HttpError, json, memberContext, serve } from '../_shared/http.ts'
import { normalizeIsbn } from '../../../shared/isbn.ts'
import { fetchGoogleByIsbn, fetchOpenLibraryByIsbn, mergeDrafts, searchCandidates } from '../../../shared/metadata.ts'

const GOOGLE_KEY = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? undefined
// ~768px JPEG from the app is ~100–200 KB of base64; reject anything absurd.
const MAX_IMAGE_CHARS = 4_000_000

serve(async (req, body) => {
  const { admin } = await memberContext(req, body.libraryId)
  const libraryId = body.libraryId as string
  const image = body.imageBase64
  if (typeof image !== 'string' || image.length < 100 || image.length > MAX_IMAGE_CHARS) {
    throw new HttpError(400, 'bad_request', 'imageBase64 must be a JPEG under ~3 MB')
  }
  const config = await aiConfig(admin, libraryId, 'vision')
  if (!config) {
    throw new HttpError(409, 'ai_not_configured', 'Cover recognition needs an OpenAI or Gemini key in AI settings')
  }
  const identification = parseIdentification(await chatJson(config, {
    system: IDENTIFY_SYSTEM,
    user: 'Identify this book.',
    imageBase64: image,
    schema: IDENTIFY_SCHEMA,
    timeoutMs: 60_000,
  }))
  if (!identification.title) {
    return json({ identification, candidates: [] })
  }

  const isbn = identification.isbn ? normalizeIsbn(identification.isbn) : null
  const [byIsbn, byText] = await Promise.all([
    isbn
      ? Promise.all([fetchOpenLibraryByIsbn(isbn.isbn13), fetchGoogleByIsbn(isbn.isbn13, GOOGLE_KEY)])
          .then(([ol, gb]) => mergeDrafts(ol, gb))
          .catch(() => null)
      : Promise.resolve(null),
    searchCandidates(identification.title, identification.authors[0] ?? null, GOOGLE_KEY).catch(() => []),
  ])
  const candidates = byIsbn ? [{ ...byIsbn, isbn13: isbn!.isbn13, isbn10: isbn!.isbn10 }, ...byText] : byText

  // The app searches its own library with the identification (RLS-scoped), so no matches are returned here.
  return json({ identification, candidates: candidates.slice(0, 8) })
})
