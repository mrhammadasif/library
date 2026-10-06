// TEST DATA ONLY. Each permission alone → exactly its endpoints get past authorization; every other write is a 403
// naming the missing permission. Reads work for every member, even with no permissions (Viewer).
import type { Permission } from '../../../shared/permissions'
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PERMISSIONS } from '../../../shared/permissions'
import { addMember, BOOK, createLibrary, createShelves, insertBook, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

interface IFixture {
  lib: string
  rackId: string
  top: string
  middle: string
  book: string
  borrowed: string
  missing: string
  archived: string
  invite: string
  victim: string
}

interface IEndpoint {
  name: string
  needs: Permission
  method: 'post' | 'put' | 'patch' | 'delete'
  path: (f: IFixture) => string
  body?: (f: IFixture) => object
}

const ENDPOINTS: IEndpoint[] = [
  { name: 'create bookcase', needs: 'shelves.manage', method: 'post', path: () => 'racks', body: () => ({ name: 'New' }) },
  { name: 'rename bookcase', needs: 'shelves.manage', method: 'patch', path: f => `racks/${f.rackId}`, body: () => ({ name: 'Renamed' }) },
  { name: 'sort bookcases', needs: 'shelves.manage', method: 'put', path: () => 'racks/order', body: f => ({ ids: [f.rackId] }) },
  { name: 'add shelf', needs: 'shelves.manage', method: 'post', path: f => `racks/${f.rackId}/shelves`, body: () => ({ name: 'Bottom' }) },
  { name: 'sort shelves', needs: 'shelves.manage', method: 'put', path: f => `racks/${f.rackId}/shelves/order`, body: f => ({ ids: [f.middle, f.top] }) },
  { name: 'rename shelf', needs: 'shelves.manage', method: 'patch', path: f => `shelves/${f.middle}`, body: () => ({ name: 'Mid' }) },
  { name: 'add book', needs: 'books.add', method: 'post', path: () => 'books', body: f => ({ shelfId: f.top, book: BOOK('Added') }) },
  { name: 'edit book', needs: 'books.edit', method: 'put', path: f => `books/${f.book}`, body: () => BOOK('Edited') },
  { name: 'move books', needs: 'books.move', method: 'post', path: () => 'books/move', body: f => ({ bookIds: [f.book], shelfId: f.middle }) },
  { name: 'lend', needs: 'loans.manage', method: 'post', path: f => `books/${f.book}/lend`, body: () => ({ borrowerName: 'Sam' }) },
  { name: 'give back', needs: 'loans.manage', method: 'post', path: f => `books/${f.borrowed}/return`, body: () => ({}) },
  { name: 'give away', needs: 'books.archive', method: 'post', path: () => 'books/archive', body: f => ({ bookIds: [f.book] }) },
  { name: 'bring back', needs: 'books.archive', method: 'post', path: f => `books/${f.archived}/restore`, body: f => ({ shelfId: f.top }) },
  { name: 'start check', needs: 'audits.run', method: 'post', path: () => 'audits', body: () => ({ mode: 'random', size: 3 }) },
  { name: 'found it', needs: 'audits.run', method: 'post', path: f => `books/${f.missing}/found`, body: () => ({}) },
  { name: 'invite', needs: 'members.manage', method: 'post', path: () => 'invites', body: () => ({ permissions: [] }) },
  { name: 'set permissions', needs: 'members.manage', method: 'put', path: f => `members/${f.victim}/permissions`, body: () => ({ permissions: [] }) },
  { name: 'revoke invite', needs: 'members.manage', method: 'delete', path: f => `invites/${f.invite}` },
  { name: 'set AI provider', needs: 'ai.manage', method: 'put', path: () => 'ai/providers/openai', body: () => ({ model: 'gpt-x', apiKey: 'sk-test' }) },
  { name: 'choose AI usage', needs: 'ai.manage', method: 'put', path: () => 'ai/usage', body: () => ({ enrich: null, vision: null }) },
  { name: 'remove AI provider', needs: 'ai.manage', method: 'delete', path: () => 'ai/providers/gemini' },
  { name: 'delete book', needs: 'books.delete', method: 'delete', path: f => `books/${f.book}` },
]

const READS = ['racks', 'books', 'loans?open=true', 'audits', 'members', 'search?q=shelf', 'tags', 'stats', 'ai/providers']

describe('permission matrix', () => {
  let t: ITestApp

  beforeAll(async () => { t = await createTestApp() })
  afterAll(() => t.close())

  async function setup(permissions: Permission[]): Promise<{ user: ITestUser, f: IFixture }> {
    await t.db.reset()
    const owner = await signUp(t, 'owner@test.local')
    const user = await signUp(t, 'member@test.local')
    const victim = await signUp(t, 'victim@test.local')
    const lib = await createLibrary(t, owner)
    await addMember(t, lib, user, permissions)
    await addMember(t, lib, victim, [])
    const s = await createShelves(t, lib)
    const f: IFixture = {
      lib,
      ...s,
      book: await insertBook(t, lib, s.top, 'On shelf'),
      borrowed: await insertBook(t, lib, s.top, 'Borrowed', { status: 'borrowed' }),
      missing: await insertBook(t, lib, s.top, 'Missing', { status: 'missing' }),
      archived: await insertBook(t, lib, null, 'Archived'),
      invite: (await t.db.prisma.libraryInvite.create({ data: { libraryId: lib, code: 'MATRIX23', expiresAt: new Date(Date.now() + 86_400_000) } })).id,
      victim: victim.id,
    }
    await t.db.prisma.loan.create({ data: { libraryId: lib, bookId: f.borrowed, borrowerName: 'Sam' } })
    return { user, f }
  }

  async function call(user: ITestUser, f: IFixture, e: IEndpoint) {
    const req = t.http()[e.method](`/api/libraries/${f.lib}/${e.path(f)}`).set('Cookie', user.cookie)
    return e.body ? req.send(e.body(f)) : req
  }

  // One setup per permission: within a run only that permission's endpoints change anything (every other call is a
  // 403 before touching data), and the endpoint order keeps each allowed call independent of the others. A per-endpoint
  // setup took >30 s per case on the home server's CPU.
  it.each(PERMISSIONS.map(p => [p]))('%s alone unlocks exactly its endpoints', async (permission) => {
    const { user, f } = await setup([permission])
    for (const e of ENDPOINTS) {
      const res = await call(user, f, e)
      if (e.needs === permission) {
        expect(res.status, `${e.name}: ${JSON.stringify(res.body)}`).toBeLessThan(400)
      }
      else {
        expect(res.status, `${e.name} should be forbidden`).toBe(403)
        expect(res.body.permission, e.name).toBe(e.needs)
      }
    }
  }, 120_000)

  it('lets every member read, even with no permissions', async () => {
    const { user, f } = await setup([])
    for (const path of READS) {
      await t.http().get(`/api/libraries/${f.lib}/${path}`).set('Cookie', user.cookie).expect(200)
    }
  })
})
