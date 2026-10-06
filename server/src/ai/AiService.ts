import type { IAiProviderConfigDto } from '../../../shared/contracts/Ai'
import type { IBookDraft } from '../../../shared/metadata'
import type { IMembership } from '../auth/Access'
import type { IAppConfig } from '../config/AppConfig'
import type { AiProvider, PrismaClient } from '../generated/prisma/client'
import { Inject, Injectable } from '@nestjs/common'
import { buildEnrichUser, chatJson, ENRICH_SCHEMA, ENRICH_SYSTEM, IDENTIFY_SCHEMA, IDENTIFY_SYSTEM, parseEnrichment, parseIdentification } from '../../../shared/ai'
import { normalizeIsbn } from '../../../shared/isbn'
import { fetchGoogleByIsbn, fetchOpenLibraryByIsbn, mergeDrafts, searchCandidates } from '../../../shared/metadata'
import { requirePermission } from '../auth/Permissions'
import { DomainError, notFound } from '../common/DomainError'
import { APP_CONFIG } from '../config/AppConfig'
import { InjectPrisma } from '../prisma/Prisma'
import { AiKeyCipher } from './AiKeyCipher'
import { OllamaClient } from './Ollama'

const VISION_BY_DEFAULT: AiProvider[] = ['openai', 'gemini']

@Injectable()
export class AiService {
  constructor(
    @InjectPrisma() private readonly prisma: PrismaClient,
    @Inject(APP_CONFIG) private readonly config: IAppConfig,
    private readonly cipher: AiKeyCipher,
    private readonly ollama: OllamaClient,
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

  /** Which provider suggests tags (null = Home AI if allowed, else off) and which reads cover photos (null = off). */
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

  /** Tag/category/description suggestions: the library's enrich provider, else Home AI when the admin allowed it. */
  async enrich(m: IMembership, draft: IBookDraft) {
    if (!m.permissions.includes('books.add')) {
      requirePermission(m, 'books.edit')
    }
    const library = await this.library(m.libraryId)
    const request = { system: ENRICH_SYSTEM, user: buildEnrichUser(draft), schema: ENRICH_SCHEMA, timeoutMs: 90_000 }
    if (library.enrichProvider) {
      const config = await this.providerConfig(m.libraryId, library.enrichProvider)
      return { enrichment: parseEnrichment(await chatJson(config, request)), provider: library.enrichProvider as string }
    }
    if (library.homeAiAllowed) {
      return { enrichment: parseEnrichment(await this.ollama.chatJson(request)), provider: 'home' }
    }
    throw new DomainError(409, 'ai_not_configured', 'No AI is set up for tag suggestions')
  }

  /** Reads a cover photo with the library's vision provider, then finds matching editions online. */
  async identifyCover(libraryId: string, imageBase64: string) {
    const library = await this.library(libraryId)
    if (!library.visionProvider) {
      throw new DomainError(409, 'ai_not_configured', 'Cover photos need an OpenAI or Gemini key in AI settings')
    }
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
        ? Promise.all([fetchOpenLibraryByIsbn(isbn.isbn13), fetchGoogleByIsbn(isbn.isbn13, this.config.GOOGLE_BOOKS_API_KEY)])
            .then(([ol, gb]) => mergeDrafts(ol, gb)).catch(() => null)
        : Promise.resolve(null),
      searchCandidates(identification.title, identification.authors[0] ?? null, this.config.GOOGLE_BOOKS_API_KEY).catch(() => []),
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
