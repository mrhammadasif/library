import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Put } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { SetOwnerInput, SetPermissionsInput } from '../../../shared/contracts/Libraries'
import type { IMembership } from '../auth/Access'
import { Membership, RequireLibrary } from '../auth/Access'
import { MembersService } from './MembersService'

class SetPermissionsDto extends createZodDto(SetPermissionsInput) {}
class SetOwnerDto extends createZodDto(SetOwnerInput) {}

@Controller('libraries/:libraryId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @RequireLibrary()
  list(@Membership() membership: IMembership) {
    return this.members.list(membership.libraryId)
  }

  @Put(':userId/permissions')
  @RequireLibrary('members.manage')
  @HttpCode(204)
  setPermissions(@Membership() membership: IMembership, @Param('userId', ParseUUIDPipe) userId: string, @Body() body: SetPermissionsDto) {
    return this.members.setPermissions(membership, userId, body.permissions)
  }

  @Put(':userId/owner')
  @RequireLibrary()
  @HttpCode(204)
  setOwner(@Membership() membership: IMembership, @Param('userId', ParseUUIDPipe) userId: string, @Body() body: SetOwnerDto) {
    return this.members.setOwner(membership, userId, body.owner)
  }

  /** Leave (your own id) or remove someone (members.manage). */
  @Delete(':userId')
  @RequireLibrary()
  @HttpCode(204)
  remove(@Membership() membership: IMembership, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.members.remove(membership, userId)
  }
}
