import { Global, Module } from '@nestjs/common'
import { GoogleBooksBudget } from './GoogleBooksBudget'

@Global()
@Module({ providers: [GoogleBooksBudget], exports: [GoogleBooksBudget] })
export class BooksBudgetModule {}
