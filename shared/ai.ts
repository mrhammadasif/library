// AI providers through one OpenAI-compatible Chat Completions adapter: OpenAI, Gemini (its /openai endpoint) and
// any OpenAI-compatible gateway (e.g. OmniRoute in front of the home-server Ollama). Prompt builders and response
// parsing are pure and unit-tested.
import type { IBookDraft } from './metadata.ts'

export type AiProvider = 'openai' | 'gemini' | 'openai_compatible'

export interface IAiConfig {
  provider: AiProvider
  model: string
  baseUrl: string | null
  apiKey: string
}

const DEFAULT_BASE_URLS: Record<Exclude<AiProvider, 'openai_compatible'>, string> = {
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
}

export function baseUrlFor(config: IAiConfig): string {
  return config.provider === 'openai_compatible' ? config.baseUrl! : DEFAULT_BASE_URLS[config.provider]
}

/** Pulls a JSON object out of a model reply: drops <think> blocks and code fences, then parses the outer {...}. */
export function extractJson(text: string): unknown {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '')
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('AI reply contained no JSON object')
  }
  return JSON.parse(stripped.slice(start, end + 1))
}

interface IChatRequest {
  system: string
  user: string
  /** Base64 JPEG for vision requests. */
  imageBase64?: string
  schema: Record<string, unknown>
  timeoutMs: number
}

export async function chatJson(config: IAiConfig, request: IChatRequest): Promise<unknown> {
  const content = request.imageBase64
    ? [
        { type: 'text', text: request.user },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${request.imageBase64}` } },
      ]
    : request.user
  const body = {
    model: config.model,
    messages: [{ role: 'system', content: request.system }, { role: 'user', content }],
    response_format: { type: 'json_schema', json_schema: { name: 'result', schema: request.schema } },
  }
  const send = (payload: Record<string, unknown>) => fetch(`${baseUrlFor(config)}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(request.timeoutMs),
  })
  let response = await send(body)
  // Some gateways/models reject json_schema; the prompt also asks for JSON, so retry without it.
  if (response.status === 400) {
    const { response_format: _, ...plain } = body
    response = await send(plain)
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300)
    throw new Error(`AI provider returned ${response.status}: ${detail}`)
  }
  const data = await response.json() as { choices?: { message?: { content?: string } }[] }
  return extractJson(data.choices?.[0]?.message?.content ?? '')
}

// ─── Metadata enrichment ────────────────────────────────────────────────────

// Kept constant so local models (Ollama) can reuse the KV cache for the prefix across calls.
export const ENRICH_SYSTEM = `You are a librarian cataloguing books in a home library.
Given what is known about a book, reply with ONLY a JSON object:
{"categories": string[], "tags": string[], "description": string, "language": string}
- categories: 1-3 broad genres in Title Case (e.g. "Science Fiction", "History", "Self-Help", "Islamic Studies").
- tags: 3-6 short lowercase keywords useful for searching a home library (themes, setting, audience, series name).
- description: 1-3 neutral sentences summarising the book, max 400 characters. Keep the given description's facts if present.
- language: ISO 639-1 code of the book's language.
Never invent ISBNs, authors or titles.`

export const ENRICH_SCHEMA = {
  type: 'object',
  properties: {
    categories: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
    description: { type: 'string' },
    language: { type: 'string' },
  },
  required: ['categories', 'tags', 'description', 'language'],
}

export function buildEnrichUser(draft: IBookDraft): string {
  return JSON.stringify({
    title: draft.title,
    subtitle: draft.subtitle,
    authors: draft.authors,
    publisher: draft.publisher,
    year: draft.publishedYear,
    subjects: draft.categories,
    description: draft.description?.slice(0, 1500) ?? null,
  })
}

export interface IEnrichment {
  categories: string[]
  tags: string[]
  description: string | null
  language: string | null
}

function strings(value: unknown, limit: number, transform: (s: string) => string): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      const v = transform(item.trim())
      if (v && v.length <= 40 && !out.includes(v)) {
        out.push(v)
      }
    }
  }
  return out.slice(0, limit)
}

/** Validates an enrichment reply; anything malformed is dropped rather than trusted. */
export function parseEnrichment(raw: unknown): IEnrichment {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const description = typeof obj.description === 'string' ? obj.description.trim().slice(0, 600) : ''
  const language = typeof obj.language === 'string' && /^[a-z]{2}$/i.test(obj.language.trim())
    ? obj.language.trim().toLowerCase()
    : null
  return {
    categories: strings(obj.categories, 3, s => s),
    tags: strings(obj.tags, 6, s => s.toLowerCase().replace(/^#/, '')),
    description: description || null,
    language,
  }
}

// ─── Cover recognition ──────────────────────────────────────────────────────

export const IDENTIFY_SYSTEM = `You identify books from photos of their covers or spines.
Reply with ONLY a JSON object:
{"title": string, "subtitle": string|null, "authors": string[], "isbn": string|null, "publisher": string|null, "confidence": number}
- Read the text printed on the cover. Use your knowledge only to correct obvious OCR-style mistakes.
- isbn: only if a barcode number or ISBN is visibly printed; otherwise null.
- confidence: 0 to 1, how sure you are of the title and author.
If no book is visible, reply {"title": "", "subtitle": null, "authors": [], "isbn": null, "publisher": null, "confidence": 0}.`

export const IDENTIFY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: ['string', 'null'] },
    authors: { type: 'array', items: { type: 'string' } },
    isbn: { type: ['string', 'null'] },
    publisher: { type: ['string', 'null'] },
    confidence: { type: 'number' },
  },
  required: ['title', 'authors', 'confidence'],
}

export interface IIdentification {
  title: string
  subtitle: string | null
  authors: string[]
  isbn: string | null
  publisher: string | null
  confidence: number
}

export function parseIdentification(raw: unknown): IIdentification {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const confidence = typeof obj.confidence === 'number' ? Math.min(1, Math.max(0, obj.confidence)) : 0
  return {
    title: str(obj.title) ?? '',
    subtitle: str(obj.subtitle),
    authors: strings(obj.authors, 5, s => s),
    isbn: str(obj.isbn),
    publisher: str(obj.publisher),
    confidence,
  }
}
