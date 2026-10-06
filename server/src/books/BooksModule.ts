import { Module } from '@nestjs/common'
import { BooksController } from './BooksController'
import { BooksService } from './BooksService'

@Module({ controllers: [BooksController], providers: [BooksService], exports: [BooksService] })
export class BooksModule {}
