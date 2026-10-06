import { Module } from '@nestjs/common'
import { ShelvesController } from './ShelvesController'
import { ShelvesService } from './ShelvesService'

@Module({ controllers: [ShelvesController], providers: [ShelvesService] })
export class ShelvesModule {}
