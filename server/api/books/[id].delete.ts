import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const id = await getValidatedRouterParams(event, z.number().parse)

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const book = await prisma.book.delete({
    where: { id },
  })
  return book
})
