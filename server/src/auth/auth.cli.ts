// Only for `npx auth generate`: lets the Better Auth CLI see the plugin set and emit Prisma models.
import { PrismaClient } from '../generated/prisma/client'
import { createAuth } from './CreateAuth'

export const auth = createAuth({
  prisma: {} as PrismaClient,
  sendOtp: async () => {},
  secret: 'cli-only-not-a-secret-cli-only-not-a-secret',
  baseUrl: 'http://localhost:3000',
})
