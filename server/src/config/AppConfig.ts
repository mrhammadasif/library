import { z } from 'zod'

const csv = z.string().transform(v => v.split(',').map(s => s.trim()).filter(Boolean))

/** Every setting the API reads, validated once at boot (a typo'd env var fails fast instead of at first use). */
export const AppConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  /** postgresql://… in production; pglite:./dir for local development without Docker. */
  DATABASE_URL: z.string().regex(/^(postgres(ql)?:\/\/|pglite:)/, 'DATABASE_URL must be postgresql://… or pglite:./dir'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  TRUSTED_ORIGINS: csv.default(['homelibrary://']),
  GOOGLE_CLIENT_IDS: csv.default([]),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Home Library <noreply@nitroxis.com>'),
  ADMIN_EMAILS: csv.default([]),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('garage'),
  S3_BUCKET: z.string().default('library-covers'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  COVERS_PUBLIC_URL: z.string().url().optional(),
  /**
   * Free tier: libraries without their own AI key get a few book-detail suggestions a day through the owner's OmniRoute
   * (`FREE_AI_PER_LIBRARY`, default 5), capped server-wide (`FREE_AI_DAILY_TOTAL`) so sign-ups can't run up the bill.
   * No key = no free tier. Text only: `hammad/free` can't read cover photos.
   */
  FREE_AI_BASE_URL: z.string().url().default('https://omniroute.home.nitroxis.com/v1'),
  FREE_AI_API_KEY: z.string().optional(),
  FREE_AI_MODEL: z.string().default('hammad/free'),
  FREE_AI_PER_LIBRARY: z.coerce.number().int().min(0).default(5),
  FREE_AI_DAILY_TOTAL: z.coerce.number().int().min(0).default(200),
  /** Test a library's AI key with a tiny request before saving it (off in the e2e suite unless a test turns it on). */
  AI_KEY_CHECK: z.stringbool().default(true),
  /** Self-hosted SearXNG (JSON format enabled) for web lookups during AI enrichment; unset = off. */
  SEARXNG_URL: z.string().url().optional(),
  /** The home SearXNG is locked; API calls send this as `X-API-Key`. */
  SEARXNG_API_KEY: z.string().optional(),
  /** 32-byte base64 key for encrypting per-library AI keys (AES-256-GCM). */
  AI_KEYS_KEY: z.string().regex(/^[A-Za-z0-9+/]{43}=$/, 'AI_KEYS_KEY must be 32 bytes, base64'),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  /** Server-wide Google Books requests per Pacific day; keep under the key's 1,000/day quota. */
  GOOGLE_BOOKS_DAILY_LIMIT: z.coerce.number().int().min(0).max(1000).default(900),
  /** Per-library daily allowances (Pacific day); trusted libraries are exempt. Spent = graceful fallback. */
  LIBRARY_DAILY_GOOGLE_BOOKS: z.coerce.number().int().min(0).default(150),
  LIBRARY_DAILY_WEB_SEARCHES: z.coerce.number().int().min(0).default(50),
  /** Online lookups (scan, ISBN or title search) per library per day: Open Library + SearXNG stay free for everyone. */
  LIBRARY_DAILY_LOOKUPS: z.coerce.number().int().min(0).default(300),
  RATE_LIMIT_ENABLED: z.stringbool().default(true),
})

export type IAppConfig = z.infer<typeof AppConfigSchema>

export const APP_CONFIG = Symbol('APP_CONFIG')

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IAppConfig {
  return AppConfigSchema.parse(env)
}
