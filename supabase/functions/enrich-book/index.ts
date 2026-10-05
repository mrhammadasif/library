// POST { libraryId, draft } → { enrichment, provider } using the library's enrich provider (e.g. Ollama via
// OmniRoute). 409 ai_not_configured when the library has none.
import type { IBookDraft } from '../_shared/metadata.ts'
import { buildEnrichUser, chatJson, ENRICH_SCHEMA, ENRICH_SYSTEM, parseEnrichment } from '../_shared/ai.ts'
import { aiConfig, HttpError, json, memberContext, serve } from '../_shared/http.ts'

serve(async (req, body) => {
  const { admin } = await memberContext(req, body.libraryId)
  const draft = body.draft as IBookDraft | undefined
  if (!draft?.title) {
    throw new HttpError(400, 'bad_request', 'draft.title is required')
  }
  const config = await aiConfig(admin, body.libraryId as string, 'enrich')
  if (!config) {
    throw new HttpError(409, 'ai_not_configured', 'No AI provider is set up for metadata enrichment')
  }
  const raw = await chatJson(config, {
    system: ENRICH_SYSTEM,
    user: buildEnrichUser(draft),
    schema: ENRICH_SCHEMA,
    // CPU-only Ollama on the home server needs ~10–30 s; stay well inside the 150 s edge limit.
    timeoutMs: 90_000,
  })
  return json({ enrichment: parseEnrichment(raw), provider: config.provider })
})
