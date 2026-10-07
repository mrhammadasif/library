// TEST DATA ONLY. Boots the real app on a test database with a captured mailbox and a fake Google token verifier.
import type { INestApplication } from '@nestjs/common'
import type { IOtpMail } from '../../src/email/Mailer'
import type { ITestDb } from './TestDb'
import request from 'supertest'
import { createApp } from '../../src/app/CreateApp'
import { createAuth } from '../../src/auth/CreateAuth'
import { loadConfig } from '../../src/config/AppConfig'
import { createTestDb } from './TestDb'

export const GOOGLE_WEB_CLIENT = 'web-client.apps.googleusercontent.com'
export const ORIGIN = 'homelibrary://'

export interface ITestApp {
  app: INestApplication
  db: ITestDb
  mailbox: IOtpMail[]
  http: () => ReturnType<typeof request>
  close: () => Promise<void>
}

/** `env` overrides config for one suite (e.g. a Books key and a tiny daily limit). */
export async function createTestApp(env: Record<string, string> = {}): Promise<ITestApp> {
  const db = await createTestDb()
  const mailbox: IOtpMail[] = []
  const config = loadConfig({
    DATABASE_URL: 'postgresql://test@localhost/test',
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
    BETTER_AUTH_URL: 'http://localhost:3000',
    ADMIN_EMAILS: 'admin@test.local',
    AI_KEYS_KEY: Buffer.alloc(32, 7).toString('base64'),
    RATE_LIMIT_ENABLED: 'false',
    // Presigning is local signing (no network), so fake storage settings are enough.
    S3_ENDPOINT: 'https://s3.test.local',
    S3_ACCESS_KEY_ID: 'test-key',
    S3_SECRET_ACCESS_KEY: 'test-secret',
    COVERS_PUBLIC_URL: 'https://covers.test.local',
    OLLAMA_URL: 'http://ollama.test:11434',
    // Outbound HTTP is stubbed in tests; a key makes lookups try Google (without one, Google is skipped).
    GOOGLE_BOOKS_API_KEY: 'test-books-key',
    ...env,
  })
  const auth = createAuth({
    prisma: db.prisma,
    mailer: { sendOtp: async (mail) => { mailbox.push(mail) } },
    secret: config.BETTER_AUTH_SECRET,
    baseUrl: config.BETTER_AUTH_URL,
    trustedOrigins: config.TRUSTED_ORIGINS,
    rateLimit: false,
    // Accepts the unsigned tokens from fakeGoogleIdToken(); production verifies against Google's keys.
    google: { clientIds: [GOOGLE_WEB_CLIENT], clientSecret: 'unused', verifyIdToken: async token => token.endsWith('.fake-signature') },
  })
  const app = await createApp({ config, prisma: db.prisma, auth }, { quiet: true })
  await app.init()
  return {
    app,
    db,
    mailbox,
    http: () => request(app.getHttpServer()),
    close: async () => { await app.close(); await db.close() },
  }
}

/** An unsigned Google-shaped ID token (only valid with the test verifier above). */
export function fakeGoogleIdToken(claims: { sub: string, email: string, name?: string, email_verified?: boolean }): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const payload = { iss: 'https://accounts.google.com', aud: GOOGLE_WEB_CLIENT, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), email_verified: true, name: 'Google User', ...claims }
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.fake-signature`
}
