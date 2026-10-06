import type { INestApplication } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { IAppDeps } from './AppModule'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { AppModule } from './AppModule'

/** Builds the HTTP app the same way for production and e2e tests. */
export async function createApp(deps: IAppDeps, { quiet = false } = {}): Promise<INestApplication> {
  // better-auth parses its own bodies; the AuthModule re-adds JSON parsing for everything else.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(deps), { bodyParser: false, logger: quiet ? false : ['error', 'warn', 'log'] })
  app.set('trust proxy', 1)
  app.setGlobalPrefix('api', { exclude: ['health'] })
  app.enableShutdownHooks()
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('Home Library API').setVersion('1').build())
  SwaggerModule.setup('docs', app, cleanupOpenApiDoc(doc))
  return app
}
