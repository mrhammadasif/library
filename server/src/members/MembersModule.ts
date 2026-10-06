import { Module } from '@nestjs/common'
import { MembersController } from './MembersController'
import { MembersService } from './MembersService'

@Module({ controllers: [MembersController], providers: [MembersService] })
export class MembersModule {}
