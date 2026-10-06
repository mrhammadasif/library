import { Module } from '@nestjs/common'
import { AuditsController } from './AuditsController'
import { AuditsService } from './AuditsService'

@Module({ controllers: [AuditsController], providers: [AuditsService] })
export class AuditsModule {}
