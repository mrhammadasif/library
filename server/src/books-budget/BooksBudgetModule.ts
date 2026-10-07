import { Global, Module } from '@nestjs/common'
import { GoogleBooksBudget } from './GoogleBooksBudget'
import { LibraryAllowance } from './LibraryAllowance'

@Global()
@Module({ providers: [GoogleBooksBudget, LibraryAllowance], exports: [GoogleBooksBudget, LibraryAllowance] })
export class BooksBudgetModule {}
