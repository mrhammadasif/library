import { Module } from '@nestjs/common'
import { LookupController } from './LookupController'
import { LookupService } from './LookupService'

@Module({ controllers: [LookupController], providers: [LookupService] })
export class LookupModule {}
