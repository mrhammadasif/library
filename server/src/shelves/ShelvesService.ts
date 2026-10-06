import type { IRackDto } from '../../../shared/contracts/Shelves'
import type { PrismaClient } from '../generated/prisma/client'
import { Injectable } from '@nestjs/common'
import { notFound } from '../common/DomainError'
import { InjectPrisma } from '../prisma/Prisma'

@Injectable()
export class ShelvesService {
  constructor(@InjectPrisma() private readonly prisma: PrismaClient) {}

  /** Bookcases in order, each with shelves in order and how many books call each shelf home. */
  async racks(libraryId: string): Promise<IRackDto[]> {
    const [racks, counts] = await Promise.all([
      this.prisma.rack.findMany({ where: { libraryId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], include: { shelves: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } } }),
      this.prisma.book.groupBy({ by: ['shelfId'], where: { libraryId, status: { not: 'archived' } }, _count: { _all: true } }),
    ])
    const countOf = new Map(counts.map(c => [c.shelfId, c._count._all]))
    return racks.map(r => ({
      id: r.id,
      name: r.name,
      notes: r.notes,
      position: r.position,
      shelves: r.shelves.map(s => ({ id: s.id, rackId: s.rackId, name: s.name, notes: s.notes, position: s.position, bookCount: countOf.get(s.id) ?? 0 })),
    }))
  }

  async createRack(libraryId: string, name: string, notes?: string | null): Promise<{ id: string }> {
    const last = await this.prisma.rack.aggregate({ where: { libraryId }, _max: { position: true } })
    return this.prisma.rack.create({ data: { libraryId, name, notes: notes ?? null, position: (last._max.position ?? 0) + 1 }, select: { id: true } })
  }

  async updateRack(libraryId: string, rackId: string, data: { name?: string, notes?: string | null }): Promise<void> {
    const { count } = await this.prisma.rack.updateMany({ where: { id: rackId, libraryId }, data })
    if (!count) {
      throw notFound('Bookcase')
    }
  }

  /** Fails with 409 in_use while any shelf in it still has books (FK restrict). */
  async deleteRack(libraryId: string, rackId: string): Promise<void> {
    const { count } = await this.prisma.rack.deleteMany({ where: { id: rackId, libraryId } })
    if (!count) {
      throw notFound('Bookcase')
    }
  }

  async reorderRacks(libraryId: string, ids: string[]): Promise<void> {
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.rack.updateMany({ where: { id, libraryId }, data: { position: i + 1 } })))
  }

  async createShelf(libraryId: string, rackId: string, name: string, notes?: string | null): Promise<{ id: string }> {
    if (!await this.prisma.rack.findFirst({ where: { id: rackId, libraryId } })) {
      throw notFound('Bookcase')
    }
    const last = await this.prisma.shelf.aggregate({ where: { rackId }, _max: { position: true } })
    return this.prisma.shelf.create({ data: { libraryId, rackId, name, notes: notes ?? null, position: (last._max.position ?? 0) + 1 }, select: { id: true } })
  }

  async updateShelf(libraryId: string, shelfId: string, data: { name?: string, notes?: string | null, rackId?: string }): Promise<void> {
    if (data.rackId && !await this.prisma.rack.findFirst({ where: { id: data.rackId, libraryId } })) {
      throw notFound('Bookcase')
    }
    const { count } = await this.prisma.shelf.updateMany({ where: { id: shelfId, libraryId }, data })
    if (!count) {
      throw notFound('Shelf')
    }
  }

  async deleteShelf(libraryId: string, shelfId: string): Promise<void> {
    const { count } = await this.prisma.shelf.deleteMany({ where: { id: shelfId, libraryId } })
    if (!count) {
      throw notFound('Shelf')
    }
  }

  async reorderShelves(libraryId: string, rackId: string, ids: string[]): Promise<void> {
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.shelf.updateMany({ where: { id, rackId, libraryId }, data: { position: i + 1 } })))
  }
}
