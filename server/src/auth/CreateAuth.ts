import type { PrismaClient } from '../generated/prisma/client'
import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { emailOTP } from 'better-auth/plugins/email-otp'

export interface IAuthDeps {
  prisma: PrismaClient
  /** Delivers one-time codes (Resend in production, captured in tests). */
  sendOtp: (args: { email: string, otp: string, type: string }) => Promise<void>
  secret: string
  baseUrl: string
}

/** The Better Auth instance. Built from injected deps so tests can run it on PGlite with a captured mailbox. */
export function createAuth({ prisma, sendOtp, secret, baseUrl }: IAuthDeps) {
  return betterAuth({
    secret,
    baseURL: baseUrl,
    basePath: '/api/auth',
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    advanced: { database: { generateId: 'uuid' } },
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    // With overrideDefaultEmailVerification the OTP plugin takes over this hook, so sign-up emails a 6-digit code.
    emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true },
    trustedOrigins: ['homelibrary://'],
    plugins: [
      expo(),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: sendOtp,
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
