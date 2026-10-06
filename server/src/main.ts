import { createApp } from './app/CreateApp'
import { createAuth } from './auth/CreateAuth'
import { loadConfig } from './config/AppConfig'
import { createResendMailer } from './email/Mailer'
import { createPrismaClient } from './prisma/Prisma'

async function bootstrap() {
  const config = loadConfig()
  const prisma = await createPrismaClient(config.DATABASE_URL)
  const auth = createAuth({
    prisma,
    mailer: createResendMailer(config.RESEND_API_KEY, config.EMAIL_FROM),
    secret: config.BETTER_AUTH_SECRET,
    baseUrl: config.BETTER_AUTH_URL,
    trustedOrigins: config.TRUSTED_ORIGINS,
    rateLimit: config.RATE_LIMIT_ENABLED,
    google: { clientIds: config.GOOGLE_CLIENT_IDS, clientSecret: config.GOOGLE_CLIENT_SECRET },
  })
  const app = await createApp({ config, prisma, auth })
  await app.listen(config.PORT, '0.0.0.0')
}

bootstrap()
