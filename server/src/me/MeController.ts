import type { UserSession } from '@thallesp/nestjs-better-auth'
import { Controller, Get } from '@nestjs/common'
import { Session } from '@thallesp/nestjs-better-auth'

@Controller('api/me')
export class MeController {
  @Get()
  me(@Session() session: UserSession) {
    return { id: session.user.id, email: session.user.email, emailVerified: session.user.emailVerified }
  }
}
