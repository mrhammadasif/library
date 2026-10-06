import type { IAppConfig } from '../config/AppConfig'
import { S3Client } from '@aws-sdk/client-s3'
import { Module } from '@nestjs/common'
import { APP_CONFIG } from '../config/AppConfig'
import { CoversController } from './CoversController'
import { CoversService, createS3Client } from './CoversService'

@Module({
  controllers: [CoversController],
  providers: [CoversService, { provide: S3Client, inject: [APP_CONFIG], useFactory: (c: IAppConfig) => createS3Client(c) }],
})
export class CoversModule {}
