import type { IMembership } from '../auth/Access'
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { LookupInput } from '../../../shared/contracts/Lookup'
import { AllowUnverified, Membership, RequireLibrary } from '../auth/Access'
import { LookupService } from './LookupService'

class LookupDto extends createZodDto(LookupInput) {}

@Controller('libraries/:libraryId/lookup')
export class LookupController {
  constructor(private readonly lookup: LookupService) {}

  /** A read in POST clothing: any member may look a book up. */
  @Post()
  @RequireLibrary()
  @AllowUnverified()
  @HttpCode(200)
  find(@Membership() m: IMembership, @Body() body: LookupDto) {
    return this.lookup.lookup(m.libraryId, body)
  }
}
