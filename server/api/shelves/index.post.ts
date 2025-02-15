import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

function randomColor() {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`
}

const prisma = new PrismaClient()

export const schema = z.object({
  name: z.string(),
  color: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema.parse)

  const shelves = prisma.shelf.create({
    data: {
      name: body.name,
      color: body.color ?? randomColor(),
    },
  })

  return shelves
})
