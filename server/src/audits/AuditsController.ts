import type { IMembership } from '../auth/Access'
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { createZodDto } from 'nestjs-zod'
import { AuditScanInput, RecordAuditItemInput, StartAuditInput } from '../../../shared/contracts/Audits'
import { Membership, RequireLibrary } from '../auth/Access'
import { AuditsService } from './AuditsService'

class StartAuditDto extends createZodDto(StartAuditInput) {}
class RecordAuditItemDto extends createZodDto(RecordAuditItemInput) {}
class AuditScanDto extends createZodDto(AuditScanInput) {}

@Controller('libraries/:libraryId/audits')
export class AuditsController {
  constructor(private readonly audits: AuditsService) {}

  @Get()
  @RequireLibrary()
  list(@Membership() m: IMembership) {
    return this.audits.list(m.libraryId)
  }

  @Post()
  @RequireLibrary('audits.run')
  start(@Membership() m: IMembership, @Body() body: StartAuditDto) {
    return this.audits.start(m, body)
  }

  @Post('items/:itemId')
  @RequireLibrary('audits.run')
  @HttpCode(204)
  record(@Membership() m: IMembership, @Param('itemId', ParseUUIDPipe) itemId: string, @Body() body: RecordAuditItemDto) {
    return this.audits.record(m, itemId, body)
  }

  @Get(':auditId')
  @RequireLibrary()
  get(@Membership() m: IMembership, @Param('auditId', ParseUUIDPipe) auditId: string) {
    return this.audits.get(m.libraryId, auditId)
  }

  @Post(':auditId/scan')
  @RequireLibrary('audits.run')
  @HttpCode(200)
  scan(@Membership() m: IMembership, @Param('auditId', ParseUUIDPipe) auditId: string, @Body() body: AuditScanDto) {
    return this.audits.scan(m, auditId, body)
  }

  @Post(':auditId/complete')
  @RequireLibrary('audits.run')
  @HttpCode(200)
  complete(@Membership() m: IMembership, @Param('auditId', ParseUUIDPipe) auditId: string) {
    return this.audits.complete(m, auditId)
  }
}
