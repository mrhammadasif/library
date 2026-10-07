import type { IMembership } from '../auth/Access'
import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, Post, Put } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { AiLimitInput, AiUsageInput, EnrichInput, IdentifyCoverInput, SetAiProviderInput } from '../../../shared/contracts/Ai'
import { AllowUnverified, Membership, RequireLibrary } from '../auth/Access'
import { AiProvider } from '../generated/prisma/client'
import { AiService } from './AiService'

class SetAiProviderDto extends createZodDto(SetAiProviderInput) {}
class AiUsageDto extends createZodDto(AiUsageInput) {}
class AiLimitDto extends createZodDto(AiLimitInput) {}
class EnrichDto extends createZodDto(EnrichInput) {}
class IdentifyCoverDto extends createZodDto(IdentifyCoverInput) {}

const ProviderParam = new ParseEnumPipe(AiProvider)

@Controller('libraries/:libraryId/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('providers')
  @RequireLibrary()
  providers(@Membership() m: IMembership) {
    return this.ai.providers(m.libraryId)
  }

  @Put('providers/:provider')
  @RequireLibrary('ai.manage')
  @HttpCode(204)
  setProvider(@Membership() m: IMembership, @Param('provider', ProviderParam) provider: AiProvider, @Body() body: SetAiProviderDto) {
    return this.ai.setProvider(m.libraryId, provider, body)
  }

  @Delete('providers/:provider')
  @RequireLibrary('ai.manage')
  @HttpCode(204)
  deleteProvider(@Membership() m: IMembership, @Param('provider', ProviderParam) provider: AiProvider) {
    return this.ai.deleteProvider(m.libraryId, provider)
  }

  @Put('usage')
  @RequireLibrary('ai.manage')
  @HttpCode(204)
  usage(@Membership() m: IMembership, @Body() body: AiUsageDto) {
    return this.ai.setUsage(m.libraryId, body)
  }

  /** The library's own daily AI cap and today's use. */
  @Get('limit')
  @RequireLibrary('ai.manage')
  limit(@Membership() m: IMembership) {
    return this.ai.aiLimit(m.libraryId)
  }

  @Put('limit')
  @RequireLibrary('ai.manage')
  @HttpCode(204)
  setLimit(@Membership() m: IMembership, @Body() body: AiLimitDto) {
    return this.ai.setAiLimit(m.libraryId, body.dailyLimit)
  }

  /** Needs books.add or books.edit (checked in the service). */
  @Post('enrich')
  @RequireLibrary()
  @HttpCode(200)
  enrich(@Membership() m: IMembership, @Body() body: EnrichDto) {
    return this.ai.enrich(m, body.draft)
  }

  /** Any member: "find it with a photo" is a search. */
  @Post('identify-cover')
  @RequireLibrary()
  @AllowUnverified()
  @HttpCode(200)
  identify(@Membership() m: IMembership, @Body() body: IdentifyCoverDto) {
    return this.ai.identifyCover(m.libraryId, body.imageBase64)
  }
}
