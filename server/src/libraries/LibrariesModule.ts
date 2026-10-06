import { Module } from '@nestjs/common'
import { LibrariesController } from './LibrariesController'
import { LibrariesService } from './LibrariesService'

@Module({ controllers: [LibrariesController], providers: [LibrariesService] })
export class LibrariesModule {}
