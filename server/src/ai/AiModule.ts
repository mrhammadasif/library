import type { IAppConfig } from '../config/AppConfig'
import { Module } from '@nestjs/common'
import { APP_CONFIG } from '../config/AppConfig'
import { AiController } from './AiController'
import { AiKeyCipher } from './AiKeyCipher'
import { AiService } from './AiService'

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    { provide: AiKeyCipher, inject: [APP_CONFIG], useFactory: (c: IAppConfig) => new AiKeyCipher(c.AI_KEYS_KEY) },
  ],
})
export class AiModule {}
