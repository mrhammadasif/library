import { PrismaClient } from '@prisma/client'

function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const shelves = prisma.shelf.findMany()
  await waitFor(1000)
  return shelves
})
