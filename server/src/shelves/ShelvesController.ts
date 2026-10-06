import type { IMembership } from '../auth/Access'
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { CreateRackInput, CreateShelfInput, OrderInput, UpdateRackInput, UpdateShelfInput } from '../../../shared/contracts/Shelves'
import { Membership, RequireLibrary } from '../auth/Access'
import { ShelvesService } from './ShelvesService'

class CreateRackDto extends createZodDto(CreateRackInput) {}
class UpdateRackDto extends createZodDto(UpdateRackInput) {}
class CreateShelfDto extends createZodDto(CreateShelfInput) {}
class UpdateShelfDto extends createZodDto(UpdateShelfInput) {}
class OrderDto extends createZodDto(OrderInput) {}

@Controller('libraries/:libraryId')
export class ShelvesController {
  constructor(private readonly shelves: ShelvesService) {}

  @Get('racks')
  @RequireLibrary()
  racks(@Membership() m: IMembership) {
    return this.shelves.racks(m.libraryId)
  }

  @Post('racks')
  @RequireLibrary('shelves.manage')
  createRack(@Membership() m: IMembership, @Body() body: CreateRackDto) {
    return this.shelves.createRack(m.libraryId, body.name, body.notes)
  }

  // Declared before 'racks/:rackId' so "order" isn't parsed as a rack id.
  @Put('racks/order')
  @RequireLibrary('shelves.manage')
  @HttpCode(204)
  reorderRacks(@Membership() m: IMembership, @Body() body: OrderDto) {
    return this.shelves.reorderRacks(m.libraryId, body.ids)
  }

  @Patch('racks/:rackId')
  @RequireLibrary('shelves.manage')
  @HttpCode(204)
  updateRack(@Membership() m: IMembership, @Param('rackId', ParseUUIDPipe) rackId: string, @Body() body: UpdateRackDto) {
    return this.shelves.updateRack(m.libraryId, rackId, body)
  }

  @Delete('racks/:rackId')
  @RequireLibrary('shelves.manage')
  @HttpCode(204)
  deleteRack(@Membership() m: IMembership, @Param('rackId', ParseUUIDPipe) rackId: string) {
    return this.shelves.deleteRack(m.libraryId, rackId)
  }

  @Post('racks/:rackId/shelves')
  @RequireLibrary('shelves.manage')
  createShelf(@Membership() m: IMembership, @Param('rackId', ParseUUIDPipe) rackId: string, @Body() body: CreateShelfDto) {
    return this.shelves.createShelf(m.libraryId, rackId, body.name, body.notes)
  }

  @Put('racks/:rackId/shelves/order')
  @RequireLibrary('shelves.manage')
  @HttpCode(204)
  reorderShelves(@Membership() m: IMembership, @Param('rackId', ParseUUIDPipe) rackId: string, @Body() body: OrderDto) {
    return this.shelves.reorderShelves(m.libraryId, rackId, body.ids)
  }

  @Patch('shelves/:shelfId')
  @RequireLibrary('shelves.manage')
  @HttpCode(204)
  updateShelf(@Membership() m: IMembership, @Param('shelfId', ParseUUIDPipe) shelfId: string, @Body() body: UpdateShelfDto) {
    return this.shelves.updateShelf(m.libraryId, shelfId, body)
  }

  @Delete('shelves/:shelfId')
  @RequireLibrary('shelves.manage')
  @HttpCode(204)
  deleteShelf(@Membership() m: IMembership, @Param('shelfId', ParseUUIDPipe) shelfId: string) {
    return this.shelves.deleteShelf(m.libraryId, shelfId)
  }
}
