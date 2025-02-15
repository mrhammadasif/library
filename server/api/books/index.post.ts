import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { title, author, isbn, shelfId, image } = body

  if (!title || !author || !isbn || !shelfId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
  }

  const book = await prisma.book.create({
    data: { title, author, isbn, shelfId, image },
  })
  return book
})
