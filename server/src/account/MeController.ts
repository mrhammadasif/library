import type { UserSession } from '@thallesp/nestjs-better-auth'
import type { IAppConfig } from '../config/AppConfig'
import { Controller, Get, Inject } from '@nestjs/common'
import { Session } from '@thallesp/nestjs-better-auth'
import { APP_CONFIG } from '../config/AppConfig'

@Controller('me')
export class MeController {
  constructor(@Inject(APP_CONFIG) private readonly config: IAppConfig) {}

  /** Free AI suggestions per library per day, or null when the server offers none (no key or 0). */
  private freeAiPerDay(): number | null {
    return this.config.FREE_AI_API_KEY && this.config.FREE_AI_PER_LIBRARY > 0 ? this.config.FREE_AI_PER_LIBRARY : null
  }

  /** The signed-in user, plus whether they're the server admin (allowed to mark libraries trusted). */
  @Get()
  me(@Session() session: UserSession) {
    const { id, name, email, emailVerified, image } = session.user
    const isAdmin = emailVerified && this.config.ADMIN_EMAILS.includes(email.toLowerCase())
    return { id, name, email, emailVerified, image: image ?? null, isAdmin, freeAiPerDay: this.freeAiPerDay() }
  }
}
