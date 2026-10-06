import type { IMailer } from '../email/Mailer'
import type { PrismaClient } from '../generated/prisma/client'
import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError } from 'better-auth/api'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { LastOwnerError, prepareAccountDeletion } from '../account/AccountDeletion'

const DAY = 60 * 60 * 24

export interface IAuthDeps {
  prisma: PrismaClient
  mailer: IMailer
  secret: string
  baseUrl: string
  trustedOrigins: string[]
  rateLimit: boolean
  google?: {
    /** Web client first: native Credential Manager ID tokens carry the web client as audience. */
    clientIds: string[]
    clientSecret: string
    /** Tests replace Google's signature check; production uses Better Auth's JWKS verification. */
    verifyIdToken?: (token: string, nonce?: string) => Promise<boolean>
  }
}

/** The Better Auth instance, built from injected deps so tests run it on PGlite with a captured mailbox. */
export function createAuth({ prisma, mailer, secret, baseUrl, trustedOrigins, rateLimit, google }: IAuthDeps) {
  return betterAuth({
    secret,
    baseURL: baseUrl,
    basePath: '/api/auth',
    trustedOrigins,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    advanced: {
      database: { generateId: 'uuid' },
      // Behind Coolify's Traefik: the client IP is in X-Forwarded-For (rate limits key on it).
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    session: { expiresIn: 90 * DAY, updateAge: DAY },
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    // With overrideDefaultEmailVerification the OTP plugin takes over this hook, so sign-up emails a 6-digit code.
    emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true },
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    socialProviders: google?.clientIds.length
      ? { google: { clientId: google.clientIds, clientSecret: google.clientSecret, verifyIdToken: google.verifyIdToken } }
      : {},
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          try {
            await prepareAccountDeletion(prisma, user.id)
          }
          catch (e) {
            if (e instanceof LastOwnerError) {
              throw new APIError('CONFLICT', { message: e.message, code: 'last_owner' })
            }
            throw e
          }
        },
      },
    },
    rateLimit: {
      enabled: rateLimit,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 10 },
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/email-otp/verify-email': { window: 60, max: 10 },
        '/sign-in/email-otp': { window: 60, max: 5 },
        '/email-otp/request-password-reset': { window: 60, max: 3 },
      },
    },
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: mail => mailer.sendOtp(mail),
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
