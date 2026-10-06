import type { IMembership } from '../auth/Access'
import { Body, Controller, Post } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { PresignCoverInput } from '../../../shared/contracts/Covers'
import { Membership, RequireLibrary } from '../auth/Access'
import { CoversService } from './CoversService'

class PresignCoverDto extends createZodDto(PresignCoverInput) {}

@Controller('libraries/:libraryId/covers')
export class CoversController {
  constructor(private readonly covers: CoversService) {}

  /** Needs books.add or books.edit (checked in the service). */
  @Post('presign')
  @RequireLibrary()
  presign(@Membership() m: IMembership, @Body() body: PresignCoverDto) {
    return this.covers.presign(m, body.bookId)
  }
}
