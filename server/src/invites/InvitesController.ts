import type { IMembership } from '../auth/Access'
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { AcceptInviteInput, CreateInviteInput } from '../../../shared/contracts/Libraries'
import { Membership, RequireLibrary, UserId } from '../auth/Access'
import { InvitesService } from './InvitesService'

class CreateInviteDto extends createZodDto(CreateInviteInput) {}
class AcceptInviteDto extends createZodDto(AcceptInviteInput) {}

@Controller()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get('libraries/:libraryId/invites')
  @RequireLibrary('members.manage')
  list(@Membership() membership: IMembership) {
    return this.invites.listActive(membership.libraryId)
  }

  @Post('libraries/:libraryId/invites')
  @RequireLibrary('members.manage')
  create(@Membership() membership: IMembership, @Body() body: CreateInviteDto) {
    return this.invites.create(membership, body)
  }

  @Delete('libraries/:libraryId/invites/:inviteId')
  @RequireLibrary('members.manage')
  @HttpCode(204)
  revoke(@Membership() membership: IMembership, @Param('inviteId', ParseUUIDPipe) inviteId: string) {
    return this.invites.revoke(membership.libraryId, inviteId)
  }

  @Post('invites/accept')
  @HttpCode(200)
  accept(@UserId() userId: string, @Body() body: AcceptInviteDto) {
    return this.invites.accept(userId, body.code)
  }
}
