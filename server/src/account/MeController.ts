import type { UserSession } from '@thallesp/nestjs-better-auth'
import type { IAppConfig } from '../config/AppConfig'
import { Controller, Get, Inject } from '@nestjs/common'
import { Session } from '@thallesp/nestjs-better-auth'
import { APP_CONFIG } from '../config/AppConfig'

@Controller('me')
export class MeController {
  constructor(@Inject(APP_CONFIG) private readonly config: IAppConfig) {}

  /** The signed-in user, plus whether they're the server admin (allowed to switch Home AI on for libraries). */
  @Get()
  me(@Session() session: UserSession) {
    const { id, name, email, emailVerified, image } = session.user
    const isAdmin = emailVerified && this.config.ADMIN_EMAILS.includes(email.toLowerCase())
    return { id, name, email, emailVerified, image: image ?? null, isAdmin }
  }
}
