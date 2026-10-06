import type { PrismaClient } from '../generated/prisma/client'
import { Controller, Get } from '@nestjs/common'
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'
import { InjectPrisma } from '../prisma/Prisma'

@Controller('health')
@AllowAnonymous()
export class HealthController {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`
    return { ok: true }
  }
}
