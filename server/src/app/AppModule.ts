import type { DynamicModule } from '@nestjs/common'
import type { Auth } from '../auth/CreateAuth'
import type { IAppConfig } from '../config/AppConfig'
import type { PrismaClient } from '../generated/prisma/client'
import { Module } from '@nestjs/common'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'
import { MeController } from '../account/MeController'
import { AccessGuard, AUTH } from '../auth/AccessGuard'
import { ErrorFilter } from '../common/ErrorFilter'
import { APP_CONFIG } from '../config/AppConfig'
import { AiModule } from '../ai/AiModule'
import { AuditsModule } from '../audits/AuditsModule'
import { BooksModule } from '../books/BooksModule'
import { CoversModule } from '../covers/CoversModule'
import { HealthController } from '../health/HealthController'
import { LoansModule } from '../loans/LoansModule'
import { LookupModule } from '../lookup/LookupModule'
import { SearchModule } from '../search/SearchModule'
import { ShelvesModule } from '../shelves/ShelvesModule'
import { InvitesModule } from '../invites/InvitesModule'
import { LibrariesModule } from '../libraries/LibrariesModule'
import { MembersModule } from '../members/MembersModule'
import { PRISMA } from '../prisma/Prisma'

export interface IAppDeps {
  config: IAppConfig
  prisma: PrismaClient
  auth: Auth
}

/** Root module built from deps, so tests can swap in PGlite and a captured mailbox. */
@Module({})
export class AppModule {
  static register({ config, prisma, auth }: IAppDeps): DynamicModule {
    return {
      module: AppModule,
      global: true,
      // AccessGuard replaces the package's global guard so the check order is ours (see AccessGuard).
      imports: [AuthModule.forRoot({ auth, disableGlobalAuthGuard: true }), LibrariesModule, MembersModule, InvitesModule, ShelvesModule, BooksModule, LoansModule, AuditsModule, SearchModule, LookupModule, AiModule, CoversModule],
      controllers: [HealthController, MeController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: PRISMA, useValue: prisma },
        { provide: AUTH, useValue: auth },
        { provide: APP_GUARD, useClass: AccessGuard },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: ErrorFilter },
      ],
      exports: [APP_CONFIG, PRISMA, AUTH],
    }
  }
}
