import { Module } from '@nestjs/common'
import { SearchController } from './SearchController'
import { SearchService } from './SearchService'

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
