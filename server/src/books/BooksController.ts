import type { IMembership } from '../auth/Access'
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { AddBookInput, ArchiveBooksInput, BookFieldsInput, ListBooksQuery, MoveBooksInput, OptionalShelfInput, ShelfTargetInput } from '../../../shared/contracts/Books'
import { Membership, RequireLibrary } from '../auth/Access'
import { BooksService } from './BooksService'

class ListBooksDto extends createZodDto(ListBooksQuery) {}
class AddBookDto extends createZodDto(AddBookInput) {}
class BookFieldsDto extends createZodDto(BookFieldsInput) {}
class MoveBooksDto extends createZodDto(MoveBooksInput) {}
class ArchiveBooksDto extends createZodDto(ArchiveBooksInput) {}
class ShelfTargetDto extends createZodDto(ShelfTargetInput) {}
class OptionalShelfDto extends createZodDto(OptionalShelfInput) {}

@Controller('libraries/:libraryId/books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  @RequireLibrary()
  list(@Membership() m: IMembership, @Query() query: ListBooksDto) {
    return this.books.list(m.libraryId, query)
  }

  @Post()
  @RequireLibrary('books.add')
  add(@Membership() m: IMembership, @Body() body: AddBookDto) {
    return this.books.add(m, body)
  }

  @Post('move')
  @RequireLibrary('books.move')
  @HttpCode(200)
  move(@Membership() m: IMembership, @Body() body: MoveBooksDto) {
    return this.books.move(m, body.bookIds, body.shelfId)
  }

  @Post('archive')
  @RequireLibrary('books.archive')
  @HttpCode(200)
  archive(@Membership() m: IMembership, @Body() body: ArchiveBooksDto) {
    return this.books.archive(m, body)
  }

  @Get(':bookId')
  @RequireLibrary()
  get(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string) {
    return this.books.get(m.libraryId, bookId)
  }

  @Get(':bookId/events')
  @RequireLibrary()
  events(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string) {
    return this.books.events(m.libraryId, bookId)
  }

  @Put(':bookId')
  @RequireLibrary('books.edit')
  @HttpCode(204)
  update(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string, @Body() body: BookFieldsDto) {
    return this.books.update(m.libraryId, bookId, body)
  }

  @Delete(':bookId')
  @RequireLibrary('books.delete')
  @HttpCode(204)
  remove(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string) {
    return this.books.remove(m.libraryId, bookId)
  }

  @Post(':bookId/restore')
  @RequireLibrary('books.archive')
  @HttpCode(204)
  restore(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string, @Body() body: ShelfTargetDto) {
    return this.books.restore(m, bookId, body.shelfId)
  }

  @Post(':bookId/found')
  @RequireLibrary('audits.run')
  @HttpCode(204)
  found(@Membership() m: IMembership, @Param('bookId', ParseUUIDPipe) bookId: string, @Body() body: OptionalShelfDto) {
    return this.books.markFound(m, bookId, body.shelfId)
  }
}
