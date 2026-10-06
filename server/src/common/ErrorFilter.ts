import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import type { Response } from 'express'
import { Catch, HttpException, Logger } from '@nestjs/common'
import { ZodValidationException } from 'nestjs-zod'
import { Prisma } from '../generated/prisma/client'
import { DomainError } from './DomainError'

interface IErrorBody {
  statusCode: number
  code: string
  message: string
  [extra: string]: unknown
}

/** One error shape for the app: { statusCode, code, message, ...extra } (e.g. permission on 403s). */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors')

  catch(error: unknown, host: ArgumentsHost) {
    const body = this.toBody(error)
    if (body.statusCode >= 500 && process.env.TEST_DEBUG) {
      console.error(error)
    }
    if (body.statusCode >= 500) {
      this.logger.error(error instanceof Error ? error.stack : String(error))
    }
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body)
  }

  private toBody(error: unknown): IErrorBody {
    if (error instanceof DomainError) {
      return { statusCode: error.status, code: error.code, message: error.message, ...error.extra }
    }
    if (error instanceof ZodValidationException) {
      const issues = error.getZodError() as { issues: { path: PropertyKey[], message: string }[] }
      return { statusCode: 400, code: 'invalid_input', message: 'Some details are missing or wrong', issues: issues.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return { statusCode: 409, code: 'duplicate', message: 'That already exists' }
      }
      // P2003 = NO ACTION FK; RESTRICT FKs (shelf with books) surface as a driver error P2039 with SQLSTATE 23001.
      if (error.code === 'P2003' || /foreign key constraint/i.test(error.message)) {
        return { statusCode: 409, code: 'in_use', message: 'This is still in use (for example a shelf that still has books). Move things off it first.' }
      }
      if (error.code === 'P2025') {
        return { statusCode: 404, code: 'not_found', message: 'Not found' }
      }
    }
    if (error instanceof HttpException) {
      const res = error.getResponse()
      const payload = typeof res === 'object' ? res as Record<string, unknown> : { message: res }
      return {
        statusCode: error.getStatus(),
        code: typeof payload.code === 'string' ? payload.code : `http_${error.getStatus()}`,
        message: typeof payload.message === 'string' ? payload.message : error.message,
        ...payload,
      } as IErrorBody
    }
    return { statusCode: 500, code: 'internal', message: 'Something went wrong' }
  }
}
