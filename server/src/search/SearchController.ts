import type { IMembership } from '../auth/Access'
import { Controller, Get, Query } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { SearchBooksQuery } from '../../../shared/contracts/Search'
import { Membership, RequireLibrary } from '../auth/Access'
import { SearchService } from './SearchService'

class SearchBooksDto extends createZodDto(SearchBooksQuery) {}

@Controller('libraries/:libraryId')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('search')
  @RequireLibrary()
  find(@Membership() m: IMembership, @Query() query: SearchBooksDto) {
    return this.search.search(m.libraryId, query)
  }

  @Get('tags')
  @RequireLibrary()
  tags(@Membership() m: IMembership) {
    return this.search.tags(m.libraryId)
  }

  @Get('stats')
  @RequireLibrary()
  stats(@Membership() m: IMembership) {
    return this.search.stats(m.libraryId)
  }
}
