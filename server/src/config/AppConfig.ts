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
  OLLAMA_URL: z.string().url().default('http://ollama:11434'),
  OLLAMA_MODEL: z.string().default('hf.co/unsloth/Qwen3.5-0.8B-GGUF:UD-Q4_K_XL'),
  /** 32-byte base64 key for encrypting per-library AI keys (AES-256-GCM). */
  AI_KEYS_KEY: z.string().regex(/^[A-Za-z0-9+/]{43}=$/, 'AI_KEYS_KEY must be 32 bytes, base64'),
  GOOGLE_BOOKS_API_KEY: z.string().optional(),
  /** Server-wide Google Books requests per Pacific day; keep under the key's 1,000/day quota. */
  GOOGLE_BOOKS_DAILY_LIMIT: z.coerce.number().int().min(0).max(1000).default(900),
  RATE_LIMIT_ENABLED: z.stringbool().default(true),
})

export type IAppConfig = z.infer<typeof AppConfigSchema>

export const APP_CONFIG = Symbol('APP_CONFIG')

export function loadConfig(env: NodeJS.ProcessEnv = process.env): IAppConfig {
  return AppConfigSchema.parse(env)
}
