import type { UserSession } from '@thallesp/nestjs-better-auth'
import type { IAppConfig } from '../config/AppConfig'
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common'
import { Session } from '@thallesp/nestjs-better-auth'
import { createZodDto } from 'nestjs-zod'
import { HomeAiInput, LibraryNameInput } from '../../../shared/contracts/Libraries'
import type { IMembership } from '../auth/Access'
import { Membership, RequireLibrary, UserId } from '../auth/Access'
import { DomainError } from '../common/DomainError'
import { APP_CONFIG } from '../config/AppConfig'
import { LibrariesService } from './LibrariesService'

class LibraryNameDto extends createZodDto(LibraryNameInput) {}
class HomeAiDto extends createZodDto(HomeAiInput) {}

@Controller('libraries')
export class LibrariesController {
  constructor(
    private readonly libraries: LibrariesService,
    @Inject(APP_CONFIG) private readonly config: IAppConfig,
  ) {}

  @Get()
  list(@UserId() userId: string) {
    return this.libraries.listMine(userId)
  }

  @Post()
  create(@UserId() userId: string, @Body() body: LibraryNameDto) {
    return this.libraries.create(userId, body.name)
  }

  @Patch(':libraryId')
  @RequireLibrary()
  @HttpCode(204)
  rename(@Membership() membership: IMembership, @Body() body: LibraryNameDto) {
    return this.libraries.rename(membership, body.name)
  }

  @Delete(':libraryId')
  @RequireLibrary()
  @HttpCode(204)
  remove(@Membership() membership: IMembership) {
    return this.libraries.remove(membership)
  }

  /** Server admin only: lets a library use the home server's Ollama. Needn't be a member. */
  @Put(':libraryId/home-ai')
  @HttpCode(204)
  async homeAi(@Session() session: UserSession, @Param('libraryId', ParseUUIDPipe) libraryId: string, @Body() body: HomeAiDto) {
    const isAdmin = session.user.emailVerified && this.config.ADMIN_EMAILS.includes(session.user.email.toLowerCase())
    if (!isAdmin) {
      throw new DomainError(403, 'admin_only', 'Only the server admin can change this')
    }
    await this.libraries.setHomeAi(libraryId, body.allowed)
  }
}
