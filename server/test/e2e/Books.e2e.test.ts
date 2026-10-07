// TEST DATA ONLY. Ports the pgTAP state-machine cases (books, loans, shelves, audits) to the API.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addMember, BOOK, createLibrary, createShelves, insertBook, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

describe('books, loans, shelves and checks', () => {
  let t: ITestApp
  let owner: ITestUser
  let lender: ITestUser
  let auditor: ITestUser
  let lib: string
  let shelves: { rackId: string, top: string, middle: string }
  const base = () => `/api/libraries/${lib}`

  beforeAll(async () => { t = await createTestApp() })
  afterAll(() => t.close())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
    lender = await signUp(t, 'lender@test.local')
    auditor = await signUp(t, 'auditor@test.local')
    lib = await createLibrary(t, owner)
    await addMember(t, lib, lender, ['loans.manage'])
    await addMember(t, lib, auditor, ['audits.run'])
    shelves = await createShelves(t, lib)
  })

  async function add(title: string, shelfId = shelves.top, extra: Record<string, unknown> = {}) {
    const res = await t.http().post(`${base()}/books`).set('Cookie', owner.cookie).send({ shelfId, book: BOOK(title, extra) })
    expect(res.status).toBe(201)
    return res.body.id as string
  }

  describe('bookcases and shelves', () => {
    it('creates, lists with counts, renames, reorders and protects shelves with books', async () => {
      const rack = await t.http().post(`${base()}/racks`).set('Cookie', owner.cookie).send({ name: 'Kids room' }).expect(201)
      const shelf = await t.http().post(`${base()}/racks/${rack.body.id}/shelves`).set('Cookie', owner.cookie).send({ name: 'Picture books' }).expect(201)
      await add('Gruffalo', shelf.body.id)
      const racks = await t.http().get(`${base()}/racks`).set('Cookie', lender.cookie).expect(200)
      expect(racks.body.map((r: { name: string }) => r.name)).toEqual(['Living room', 'Kids room'])
      expect(racks.body[1].shelves[0]).toMatchObject({ name: 'Picture books', bookCount: 1, position: 1 })

      await t.http().put(`${base()}/racks/order`).set('Cookie', owner.cookie).send({ ids: [rack.body.id, shelves.rackId] }).expect(204)
      expect((await t.http().get(`${base()}/racks`).set('Cookie', owner.cookie)).body[0].name).toBe('Kids room')
      await t.http().put(`${base()}/racks/${shelves.rackId}/shelves/order`).set('Cookie', owner.cookie).send({ ids: [shelves.middle, shelves.top] }).expect(204)
      expect((await t.http().get(`${base()}/racks`).set('Cookie', owner.cookie)).body[1].shelves[0].name).toBe('Middle')

      const busy = await t.http().delete(`${base()}/shelves/${shelf.body.id}`).set('Cookie', owner.cookie).expect(409)
      expect(busy.body.code).toBe('in_use')
      await t.http().delete(`${base()}/racks/${rack.body.id}`).set('Cookie', owner.cookie).expect(409)
      await t.http().delete(`${base()}/shelves/${shelves.middle}`).set('Cookie', owner.cookie).expect(204)
    })

    it('keeps shelves inside their library', async () => {
      const other = await createLibrary(t, owner, 'Office')
      const otherShelves = await createShelves(t, other)
      await t.http().post(`${base()}/racks/${otherShelves.rackId}/shelves`).set('Cookie', owner.cookie).send({ name: 'X' }).expect(404)
      await t.http().patch(`${base()}/shelves/${shelves.top}`).set('Cookie', owner.cookie).send({ rackId: otherShelves.rackId }).expect(404)
      const res = await t.http().post(`${base()}/books`).set('Cookie', owner.cookie).send({ shelfId: otherShelves.top, book: BOOK('Wrong') }).expect(404)
      expect(res.body.code).toBe('shelf_not_found')
    })
  })

  describe('books', () => {
    it('adds on a shelf, ignores status in the payload and records history', async () => {
      const id = await add('Dune', shelves.top, { authors: ['Frank Herbert'], tags: ['SciFi', 'scifi', 'Classic'], status: 'archived' })
      const book = await t.http().get(`${base()}/books/${id}`).set('Cookie', lender.cookie).expect(200)
      expect(book.body).toMatchObject({ status: 'on_shelf', shelfId: shelves.top, tags: ['scifi', 'classic'] })
      expect(book.body.lastSeenAt).toBeTruthy()
      const events = await t.http().get(`${base()}/books/${id}/events`).set('Cookie', lender.cookie).expect(200)
      expect(events.body).toEqual([expect.objectContaining({ type: 'created', toShelfId: shelves.top, actorName: 'owner' })])
      expect((await t.db.prisma.book.findUniqueOrThrow({ where: { id } })).authorsText).toBe('Frank Herbert')
    })

    it('accepts a client id (cover uploaded first) and rejects a duplicate id', async () => {
      const id = '44444444-0000-4000-8000-000000000001'
      await t.http().post(`${base()}/books`).set('Cookie', owner.cookie).send({ id, shelfId: shelves.top, book: BOOK('A') }).expect(201)
      const dup = await t.http().post(`${base()}/books`).set('Cookie', owner.cookie).send({ id, shelfId: shelves.top, book: BOOK('B') }).expect(409)
      expect(dup.body.code).toBe('duplicate')
    })

    it('rejects bad metadata', async () => {
      const res = await t.http().post(`${base()}/books`).set('Cookie', owner.cookie).send({ shelfId: shelves.top, book: BOOK('X', { isbn13: '123' }) }).expect(400)
      expect(res.body.code).toBe('invalid_input')
    })

    it('lists by shelf, recent and given-away, and finds copies by ISBN', async () => {
      await add('B book', shelves.top, { isbn13: '9780441172719' })
      await add('A book', shelves.middle)
      await insertBook(t, lib, null, 'Gone')
      const shelf = await t.http().get(`${base()}/books?shelfId=${shelves.top}`).set('Cookie', owner.cookie).expect(200)
      expect(shelf.body.map((b: { title: string }) => b.title)).toEqual(['B book'])
      const all = await t.http().get(`${base()}/books`).set('Cookie', owner.cookie).expect(200)
      expect(all.body.map((b: { title: string }) => b.title)).toEqual(['A book', 'B book'])
      const gone = await t.http().get(`${base()}/books?status=archived&order=archived`).set('Cookie', owner.cookie).expect(200)
      expect(gone.body).toHaveLength(1)
      const copies = await t.http().get(`${base()}/books?isbn=9780441172719`).set('Cookie', owner.cookie).expect(200)
      expect(copies.body).toHaveLength(1)
    })

    it('edits metadata (books.edit) but never status', async () => {
      const id = await add('Dune')
      await t.http().put(`${base()}/books/${id}`).set('Cookie', owner.cookie).send({ ...BOOK('Dune Messiah'), status: 'archived' }).expect(204)
      const book = await t.http().get(`${base()}/books/${id}`).set('Cookie', owner.cookie).expect(200)
      expect(book.body).toMatchObject({ title: 'Dune Messiah', status: 'on_shelf' })
    })

    it('moves books, skipping ones already there and given away', async () => {
      const a = await add('A')
      const b = await add('B', shelves.middle)
      const gone = await insertBook(t, lib, null, 'Gone')
      const res = await t.http().post(`${base()}/books/move`).set('Cookie', owner.cookie).send({ bookIds: [a, b, gone], shelfId: shelves.middle }).expect(200)
      expect(res.body.count).toBe(1)
      expect((await t.db.prisma.book.findUniqueOrThrow({ where: { id: a } })).shelfId).toBe(shelves.middle)
    })

    it('gives away (closing loans), then brings back', async () => {
      const id = await add('Dune')
      await t.http().post(`${base()}/books/${id}/lend`).set('Cookie', lender.cookie).send({ borrowerName: 'Sam' }).expect(201)
      await t.http().post(`${base()}/books/archive`).set('Cookie', owner.cookie).send({ bookIds: [id], reason: 'donated', recipient: 'School' }).expect(200)
      const book = (await t.http().get(`${base()}/books/${id}`).set('Cookie', owner.cookie)).body
      expect(book).toMatchObject({ status: 'archived', shelfId: null, donatedTo: 'School', archiveReason: 'donated' })
      expect(await t.db.prisma.loan.count({ where: { returnedAt: null } })).toBe(0)
      await t.http().post(`${base()}/books/${id}/restore`).set('Cookie', owner.cookie).send({ shelfId: shelves.middle }).expect(204)
      expect((await t.http().get(`${base()}/books/${id}`).set('Cookie', owner.cookie)).body).toMatchObject({ status: 'on_shelf', shelfId: shelves.middle, donatedTo: null })
      const again = await t.http().post(`${base()}/books/${id}/restore`).set('Cookie', owner.cookie).send({ shelfId: shelves.top }).expect(409)
      expect(again.body.code).toBe('not_archived')
    })

    it('never touches books from another library', async () => {
      const other = await createLibrary(t, owner, 'Office')
      const otherShelves = await createShelves(t, other)
      const foreign = await insertBook(t, other, otherShelves.top, 'Theirs')
      await t.http().get(`${base()}/books/${foreign}`).set('Cookie', owner.cookie).expect(404)
      await t.http().post(`${base()}/books/${foreign}/lend`).set('Cookie', owner.cookie).send({ borrowerName: 'X' }).expect(404)
      const moved = await t.http().post(`${base()}/books/move`).set('Cookie', owner.cookie).send({ bookIds: [foreign], shelfId: shelves.top }).expect(200)
      expect(moved.body.count).toBe(0)
      await t.http().delete(`${base()}/books/${foreign}`).set('Cookie', owner.cookie).expect(404)
    })
  })

  describe('loans', () => {
    it('records who has a missing book: missing → borrowed → back on its shelf', async () => {
      const id = await add('Lost and found')
      await t.db.prisma.book.update({ where: { id }, data: { status: 'missing' } })
      await t.http().post(`${base()}/books/${id}/lend`).set('Cookie', lender.cookie).send({ borrowerName: 'Cousin Ali' }).expect(201)
      expect((await t.http().get(`${base()}/books/${id}`).set('Cookie', lender.cookie)).body.status).toBe('borrowed')
      await t.http().post(`${base()}/books/${id}/return`).set('Cookie', lender.cookie).send({}).expect(204)
      expect((await t.http().get(`${base()}/books/${id}`).set('Cookie', lender.cookie)).body.status).toBe('on_shelf')
    })

    it('lends, refuses to lend twice, lists, and returns to the home shelf', async () => {
      const id = await add('Dune')
      const due = new Date(Date.now() - 86_400_000).toISOString()
      await t.http().post(`${base()}/books/${id}/lend`).set('Cookie', lender.cookie).send({ borrowerName: 'Neighbour Sam', contact: '0300', dueAt: due }).expect(201)
      expect((await t.http().get(`${base()}/books/${id}`).set('Cookie', lender.cookie)).body.status).toBe('borrowed')
      const twice = await t.http().post(`${base()}/books/${id}/lend`).set('Cookie', lender.cookie).send({ borrowerName: 'Eve' }).expect(409)
      expect(twice.body.code).toBe('not_on_shelf')
      const open = await t.http().get(`${base()}/loans?open=true`).set('Cookie', lender.cookie).expect(200)
      expect(open.body).toEqual([expect.objectContaining({ bookTitle: 'Dune', borrowerName: 'Neighbour Sam', borrowerContact: '0300', returnedAt: null })])

      await t.http().post(`${base()}/books/${id}/return`).set('Cookie', lender.cookie).send({}).expect(204)
      const book = (await t.http().get(`${base()}/books/${id}`).set('Cookie', lender.cookie)).body
      expect(book).toMatchObject({ status: 'on_shelf', shelfId: shelves.top })
      expect((await t.http().get(`${base()}/loans?open=true`).set('Cookie', lender.cookie)).body).toEqual([])
      expect((await t.http().get(`${base()}/loans?bookId=${id}`).set('Cookie', lender.cookie)).body).toHaveLength(1)
      const notOut = await t.http().post(`${base()}/books/${id}/return`).set('Cookie', lender.cookie).send({}).expect(409)
      expect(notOut.body.code).toBe('not_borrowed')
    })

    it('lends to a member by id and validates borrowers', async () => {
      const id = await add('Dune')
      await t.http().post(`${base()}/books/${id}/lend`).set('Cookie', lender.cookie).send({ borrowerUserId: lender.id }).expect(201)
      const loans = (await t.http().get(`${base()}/loans?open=true`).set('Cookie', lender.cookie)).body
      expect(loans[0]).toMatchObject({ borrowerUserId: lender.id, borrowerName: 'lender' })
      const other = await add('Other')
      const outsider = await signUp(t, 'outsider@test.local')
      const res = await t.http().post(`${base()}/books/${other}/lend`).set('Cookie', lender.cookie).send({ borrowerUserId: outsider.id }).expect(400)
      expect(res.body.code).toBe('not_a_member')
      await t.http().post(`${base()}/books/${other}/lend`).set('Cookie', lender.cookie).send({}).expect(400)
    })

    it('needs books.move to return a book to a different shelf', async () => {
      const id = await add('Dune')
      await t.http().post(`${base()}/books/${id}/lend`).set('Cookie', lender.cookie).send({ borrowerName: 'Sam' }).expect(201)
      const res = await t.http().post(`${base()}/books/${id}/return`).set('Cookie', lender.cookie).send({ shelfId: shelves.middle }).expect(403)
      expect(res.body.permission).toBe('books.move')
      await t.http().post(`${base()}/books/${id}/return`).set('Cookie', owner.cookie).send({ shelfId: shelves.middle }).expect(204)
      expect((await t.db.prisma.book.findUniqueOrThrow({ where: { id } })).shelfId).toBe(shelves.middle)
    })

    it('keeps one open loan per book even if two lends race (one wins)', async () => {
      const id = await add('Dune')
      const results = await Promise.all([1, 2].map(n => t.http().post(`${base()}/books/${id}/lend`).set('Cookie', lender.cookie).send({ borrowerName: `Kid ${n}` })))
      expect(results.map(r => r.status).sort()).toEqual([201, 409])
      expect(await t.db.prisma.loan.count()).toBe(1)
    })
  })

  describe('book checks', () => {
    it('runs a shelf check: scan found, scan unexpected, finish marks the rest missing, found again', async () => {
      const dune = await add('Dune', shelves.top, { isbn13: '9780441172719' })
      const hobbit = await add('The Hobbit')
      const elsewhere = await add('Clean Code', shelves.middle)
      const started = await t.http().post(`${base()}/audits`).set('Cookie', auditor.cookie).send({ mode: 'shelf', shelfId: shelves.top }).expect(201)
      const audit = `${base()}/audits/${started.body.id}`
      expect((await t.http().get(audit).set('Cookie', auditor.cookie)).body.items).toHaveLength(2)

      const scan1 = await t.http().post(`${audit}/scan`).set('Cookie', auditor.cookie).send({ isbn: '9780441172719' }).expect(200)
      expect(scan1.body).toMatchObject({ result: 'found', bookId: dune, already: false })
      const again = await t.http().post(`${audit}/scan`).set('Cookie', auditor.cookie).send({ isbn: '9780441172719' }).expect(200)
      expect(again.body.already).toBe(true)
      const scan2 = await t.http().post(`${audit}/scan`).set('Cookie', auditor.cookie).send({ bookId: elsewhere }).expect(200)
      expect(scan2.body).toMatchObject({ result: 'unexpected', bookId: elsewhere })
      const unknown = await t.http().post(`${audit}/scan`).set('Cookie', auditor.cookie).send({ isbn: '9780262033848' }).expect(200)
      expect(unknown.body).toMatchObject({ result: 'unexpected', bookId: null })

      const done = await t.http().post(`${audit}/complete`).set('Cookie', auditor.cookie).expect(200)
      expect(done.body).toMatchObject({ found: 1, missing: 1, unexpected: 2, pending: 0 })
      expect((await t.db.prisma.book.findUniqueOrThrow({ where: { id: hobbit } })).status).toBe('missing')
      await t.http().post(`${audit}/complete`).set('Cookie', auditor.cookie).expect(409)
      await t.http().post(`${audit}/scan`).set('Cookie', auditor.cookie).send({ bookId: hobbit }).expect(409)

      await t.http().post(`${base()}/books/${hobbit}/found`).set('Cookie', auditor.cookie).send({}).expect(204)
      expect((await t.db.prisma.book.findUniqueOrThrow({ where: { id: hobbit } })).status).toBe('on_shelf')
      const notMissing = await t.http().post(`${base()}/books/${hobbit}/found`).set('Cookie', auditor.cookie).send({}).expect(409)
      expect(notMissing.body.code).toBe('not_missing')
    })

    it('runs a quick check with answers, misplaced books and moving (books.move)', async () => {
      await add('A')
      await add('B')
      const started = await t.http().post(`${base()}/audits`).set('Cookie', auditor.cookie).send({ mode: 'random', size: 5 }).expect(201)
      const detail = (await t.http().get(`${base()}/audits/${started.body.id}`).set('Cookie', auditor.cookie)).body
      expect(detail.items).toHaveLength(2)
      const [first, second] = detail.items
      await t.http().post(`${base()}/audits/items/${first.id}`).set('Cookie', auditor.cookie).send({ result: 'found' }).expect(204)
      const noShelf = await t.http().post(`${base()}/audits/items/${second.id}`).set('Cookie', auditor.cookie).send({ result: 'misplaced' }).expect(400)
      expect(noShelf.body.code).toBe('shelf_required')
      const moveDenied = await t.http().post(`${base()}/audits/items/${second.id}`).set('Cookie', auditor.cookie).send({ result: 'misplaced', foundShelfId: shelves.middle, move: true }).expect(403)
      expect(moveDenied.body.permission).toBe('books.move')
      await t.http().post(`${base()}/audits/items/${second.id}`).set('Cookie', auditor.cookie).send({ result: 'misplaced', foundShelfId: shelves.middle }).expect(204)
      expect((await t.db.prisma.book.findUniqueOrThrow({ where: { id: second.bookId } })).shelfId).toBe(shelves.top)
      await t.http().post(`${base()}/audits/items/${second.id}`).set('Cookie', owner.cookie).send({ result: 'misplaced', foundShelfId: shelves.middle, move: true }).expect(204)
      expect((await t.db.prisma.book.findUniqueOrThrow({ where: { id: second.bookId } })).shelfId).toBe(shelves.middle)

      const list = await t.http().get(`${base()}/audits`).set('Cookie', lender.cookie).expect(200)
      expect(list.body[0].counts).toMatchObject({ found: 1, misplaced: 1, pending: 0 })
    })

    it('refuses a quick check of an empty library', async () => {
      const res = await t.http().post(`${base()}/audits`).set('Cookie', auditor.cookie).send({ mode: 'random', size: 5 }).expect(409)
      expect(res.body.code).toBe('nothing_to_check')
      await t.http().post(`${base()}/audits`).set('Cookie', auditor.cookie).send({ mode: 'shelf' }).expect(400)
    })
  })
})
