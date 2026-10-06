import type { IMembership } from '../auth/Access'
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { OptionalShelfInput } from '../../../shared/contracts/Books'
import { LendInput, ListLoansQuery } from '../../../shared/contracts/Loans'
import { Membership, RequireLibrary } from '../auth/Access'
import { LoansService } from './LoansService'

class ListLoansDto extends createZodDto(ListLoansQuery) {}
class LendDto extends createZodDto(LendInput) {}
class OptionalShelfDto extends createZodDto(OptionalShelfInput) {}

@Controller('libraries/:libraryId')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get('loans')
  @RequireLibrary()
  list(@Membership() m: IMembership, @Query() query: ListLoansDto) {
    return this.loans.list(m.libraryId, query)
  }

  @Post('books/:bookId/lend')
  @RequireLibrary('loans.manage')
  lend(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string, @Body() body: LendDto) {
    return this.loans.lend(m, bookId, body)
  }

  @Post('books/:bookId/return')
  @RequireLibrary('loans.manage')
  @HttpCode(204)
  giveBack(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string, @Body() body: OptionalShelfDto) {
    return this.loans.giveBack(m, bookId, body.shelfId)
  }
}
