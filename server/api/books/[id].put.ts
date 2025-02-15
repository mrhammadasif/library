import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const id = await getValidatedRouterParams(event, z.number().parse)
  const { lentTo, lentDate } = body

  if (!id || !lentTo || !lentDate) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const book = await prisma.book.update({
    where: { id },
    data: { lentTo, lentDate },
  })
  return book
})
