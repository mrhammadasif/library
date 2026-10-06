import type { DynamicModule } from '@nestjs/common'
import type { Auth } from '../auth/CreateAuth'
import type { PrismaClient } from '../generated/prisma/client'
import { Module } from '@nestjs/common'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { MeController } from '../me/MeController'

export const PRISMA = Symbol('PRISMA')

interface IAppDeps {
  prisma: PrismaClient
  auth: Auth
}

/** Root module built from deps, so tests can swap in PGlite and a captured mailbox. */
@Module({})
export class AppModule {
  static register({ prisma, auth }: IAppDeps): DynamicModule {
    return {
      module: AppModule,
      imports: [AuthModule.forRoot({ auth })],
      controllers: [MeController],
      providers: [{ provide: PRISMA, useValue: prisma }],
    }
  }
}
