import type { IAiConfig } from '../../../shared/ai'
import type { IAiProviderConfigDto } from '../../../shared/contracts/Ai'
import type { IBookDraft } from '../../../shared/metadata'
import type { IAppConfig } from '../config/AppConfig'
import type { IMembership } from '../auth/Access'
import type { AiProvider, PrismaClient } from '../generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { buildEnrichUser, chatJson, ENRICH_SCHEMA, ENRICH_SYSTEM, IDENTIFY_SCHEMA, IDENTIFY_SYSTEM, parseEnrichment, parseIdentification } from '../../../shared/ai'
import { normalizeIsbn } from '../../../shared/isbn'
import { fetchGoogleByIsbn, fetchOpenLibraryByIsbn, mergeDrafts, searchCandidates } from '../../../shared/metadata'
import { bookQuery, needsWebSearch, relevantResults, searchWeb } from '../../../shared/webSearch'
import { requirePermission } from '../auth/Permissions'
import { GoogleBooksBudget } from '../books-budget/GoogleBooksBudget'
import { LibraryAllowance } from '../books-budget/LibraryAllowance'
import { APP_CONFIG } from '../config/AppConfig'
import { DomainError, notFound } from '../common/DomainError'
import { InjectPrisma } from '../prisma/Prisma'
import { AiKeyCipher } from './AiKeyCipher'

const VISION_BY_DEFAULT: AiProvider[] = ['openai', 'gemini']

@Injectable()
export class AiService {
  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    private readonly cipher: AiKeyCipher,
    private readonly googleBooks: GoogleBooksBudget,
    private readonly allowance: LibraryAllowance,
    @Inject(APP_CONFIG) private readonly config: IAppConfig,
  ) {}

  async providers(libraryId: string): Promise<IAiProviderConfigDto[]> {
    const rows = await this.prisma.libraryAiProvider.findMany({ where: { libraryId }, orderBy: { provider: 'asc' } })
    // Keys never leave the server: only whether one is stored.
    return rows.map(r => ({ provider: r.provider, model: r.model, baseUrl: r.baseUrl, supportsVision: r.supportsVision, hasKey: !!r.keyCiphertext }))
  }

  /** Creates or updates a provider. A blank key keeps the stored one. */
  async setProvider(libraryId: string, provider: AiProvider, input: { model: string, baseUrl?: string | null, apiKey?: string | null, supportsVision: boolean }): Promise<void> {
    const existing = await this.prisma.libraryAiProvider.findUnique({ where: { libraryId_provider: { libraryId, provider } } })
    const key = input.apiKey?.trim() || null
    if (!existing && !key) {
      throw new DomainError(400, 'key_required', 'An API key is required')
    }
    const baseUrl = provider === 'openai_compatible' ? input.baseUrl?.replace(/\/+$/, '') ?? null : null
    if (provider === 'openai_compatible' && !baseUrl?.startsWith('https://')) {
      throw new DomainError(400, 'https_required', 'The base URL must start with https://')
    }
    // Prove the key (and model) work before storing them, so a typo shows up now rather than as a failed lookup later.
    if (this.config.AI_KEY_CHECK && (key || existing?.model !== input.model || existing?.baseUrl !== baseUrl)) {
      await this.checkProvider({ provider, model: input.model, baseUrl, apiKey: key ?? this.cipher.open(existing!) })
    }
    const data = {
      model: input.model,
      baseUrl,
      supportsVision: VISION_BY_DEFAULT.includes(provider) || input.supportsVision,
      ...(key ? this.cipher.seal(key) : {}),
    }
    if (existing) {
      await this.prisma.libraryAiProvider.update({ where: { id: existing.id }, data })
    }
    else {
      await this.prisma.libraryAiProvider.create({ data: { libraryId, provider, ...data, ...this.cipher.seal(key!) } })
    }
  }

  /** One tiny request with the given settings; provider errors become messages people can act on. */
  private async checkProvider(config: IAiConfig): Promise<void> {
    try {
      await chatJson(config, {
        system: 'Reply with ONLY this JSON: {"ok": true}',
        user: 'ping',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        timeoutMs: 20_000,
      })
    }
    catch (error) {
      const status = Number((error as Error).message.match(/returned (\d{3})/)?.[1])
      if (status === 401 || status === 403) {
        throw new DomainError(400, 'invalid_key', 'That key didn\'t work. Check it was copied in full.')
      }
      if (status === 400 || status === 404) {
        throw new DomainError(400, 'invalid_model', `The model "${config.model}" isn't available with this key.`)
      }
      if (status === 429) {
        // Rate-limited means the key itself is fine.
        return
      }
      if (!status && !(error instanceof SyntaxError) && !/no JSON object/.test((error as Error).message)) {
        throw new DomainError(400, 'provider_unreachable', 'Couldn\'t reach it. Check the address and try again.')
      }
      if (status >= 500) {
        throw new DomainError(400, 'provider_unreachable', 'The AI service had a problem. Try again in a minute.')
      }
    }
  }

  async deleteProvider(libraryId: string, provider: AiProvider): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.libraryAiProvider.deleteMany({ where: { libraryId, provider } })
      const library = await tx.library.findUniqueOrThrow({ where: { id: libraryId } })
      await tx.library.update({
        where: { id: libraryId },
        data: {
          enrichProvider: library.enrichProvider === provider ? null : library.enrichProvider,
          visionProvider: library.visionProvider === provider ? null : library.visionProvider,
        },
      })
    })
  }

  /** Which provider suggests tags and which reads cover photos (null = off). */
  async setUsage(libraryId: string, usage: { enrich: AiProvider | null, vision: AiProvider | null }): Promise<void> {
    const configured = await this.prisma.libraryAiProvider.findMany({ where: { libraryId } })
    if (usage.enrich && !configured.some(p => p.provider === usage.enrich)) {
      throw new DomainError(400, 'not_configured', 'Set that provider up first')
    }
    if (usage.vision && !configured.some(p => p.provider === usage.vision && p.supportsVision)) {
      throw new DomainError(400, 'no_vision', 'That provider can\'t read cover photos')
    }
    await this.prisma.library.update({ where: { id: libraryId }, data: { enrichProvider: usage.enrich, visionProvider: usage.vision } })
  }

  /**
   * Tag/category/description suggestions with the library's own AI key (people bring their own; the server has none).
   * When the book databases left gaps (no ISBN, publisher, year…), the AI also reads web search results (SearXNG) and
   * fills them; an ISBN is only accepted if it was printed in one of those results.
   */
  async enrich(m: IMembership, draft: IBookDraft) {
    if (!m.permissions.includes('books.add')) {
      requirePermission(m, 'books.edit')
    }
    const library = await this.library(m.libraryId)
    if (!library.enrichProvider) {
      throw new DomainError(409, 'ai_not_configured', 'Add an AI key in Smart helpers to get tag suggestions')
    }
    await this.takeAiRequest(library)
    // Web searches go out through the home connection, so they come from the library's daily allowance.
    const web = this.config.SEARXNG_URL && needsWebSearch(draft) && await this.allowance.take(library, 'web_search')
      ? relevantResults(draft, await searchWeb(this.config.SEARXNG_URL, bookQuery(draft), { apiKey: this.config.SEARXNG_API_KEY }))
      : []
    const request = { system: ENRICH_SYSTEM, user: buildEnrichUser(draft, web), schema: ENRICH_SCHEMA, timeoutMs: 60_000 }
    const raw = await chatJson(await this.providerConfig(m.libraryId, library.enrichProvider), request)
    return { enrichment: parseEnrichment(raw, web), provider: library.enrichProvider as string }
  }

  /**
   * Counts every AI request against the library's own daily limit (always counted, so the settings screen can show
   * today's use; enforced only when a limit is set).
   */
  private async takeAiRequest(library: { id: string, aiDailyLimit: number | null }): Promise<void> {
    // "No limit" still counts, so it needs a number Postgres' integer column can compare with.
    const limit = library.aiDailyLimit ?? 2_147_483_647
    if (!await this.allowance.takeUpTo(library.id, 'ai', limit)) {
      throw new DomainError(429, 'ai_daily_limit', `This library's AI limit of ${limit} a day is used up. Try again tomorrow, or raise it in Smart helpers.`)
    }
  }

  async aiLimit(libraryId: string) {
    const library = await this.library(libraryId)
    return { dailyLimit: library.aiDailyLimit, usedToday: await this.allowance.usedToday(libraryId, 'ai') }
  }

  async setAiLimit(libraryId: string, dailyLimit: number | null): Promise<void> {
    await this.prisma.library.update({ where: { id: libraryId }, data: { aiDailyLimit: dailyLimit } })
  }

  /** Reads a cover photo with the library's vision provider, then finds matching editions online. */
  async identifyCover(libraryId: string, imageBase64: string) {
    const library = await this.library(libraryId)
    if (!library.visionProvider) {
      throw new DomainError(409, 'ai_not_configured', 'Cover photos need an OpenAI or Gemini key in AI settings')
    }
    await this.takeAiRequest(library)
    const config = await this.providerConfig(libraryId, library.visionProvider)
    const identification = parseIdentification(await chatJson(config, {
      system: IDENTIFY_SYSTEM,
      user: 'Identify this book.',
      imageBase64,
      schema: IDENTIFY_SCHEMA,
      timeoutMs: 60_000,
    }))
    if (!identification.title) {
      return { identification, candidates: [] }
    }
    const isbn = identification.isbn ? normalizeIsbn(identification.isbn) : null
    const [byIsbn, byText] = await Promise.all([
      isbn
        ? Promise.all([fetchOpenLibraryByIsbn(isbn.isbn13), fetchGoogleByIsbn(isbn.isbn13, this.googleBooks.access(library))])
            .then(([ol, gb]) => mergeDrafts(ol, gb)).catch(() => null)
        : Promise.resolve(null),
      searchCandidates(identification.title, identification.authors[0] ?? null, this.googleBooks.access(library)).catch(() => []),
    ])
    const candidates = byIsbn ? [{ ...byIsbn, isbn13: isbn!.isbn13, isbn10: isbn!.isbn10 }, ...byText] : byText
    return { identification, candidates: candidates.slice(0, 8) }
  }

  private async library(libraryId: string) {
    const library = await this.prisma.library.findUnique({ where: { id: libraryId } })
    if (!library) {
      throw notFound('Library')
    }
    return library
  }

  private async providerConfig(libraryId: string, provider: AiProvider) {
    const row = await this.prisma.libraryAiProvider.findUnique({ where: { libraryId_provider: { libraryId, provider } } })
    if (!row) {
      throw new DomainError(409, 'ai_not_configured', 'That AI provider isn\'t set up any more')
    }
    return { provider: row.provider, model: row.model, baseUrl: row.baseUrl, apiKey: this.cipher.open(row) }
  }
}
