import { Module } from '@nestjs/common'
import { InvitesController } from './InvitesController'
import { InvitesService } from './InvitesService'

@Module({ controllers: [InvitesController], providers: [InvitesService] })
export class InvitesModule {}
