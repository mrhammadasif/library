// TEST DATA ONLY. Ports the pgTAP isolation / escalation / invite / ownership cases to the API.
import type { ITestUser } from '../setup/Fixtures'
import type { ITestApp } from '../setup/TestApp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addMember, createLibrary, signUp } from '../setup/Fixtures'
import { createTestApp } from '../setup/TestApp'

describe('libraries, members and invites', () => {
  let t: ITestApp
  let owner: ITestUser
  let manager: ITestUser
  let lender: ITestUser
  let outsider: ITestUser
  let lib: string

  beforeAll(async () => { t = await createTestApp() })
  afterAll(() => t.close())
  beforeEach(async () => {
    await t.db.reset()
    owner = await signUp(t, 'owner@test.local')
    manager = await signUp(t, 'manager@test.local')
    lender = await signUp(t, 'lender@test.local')
    outsider = await signUp(t, 'outsider@test.local')
    lib = await createLibrary(t, owner)
    await addMember(t, lib, manager, ['members.manage', 'books.add'])
    await addMember(t, lib, lender, ['loans.manage'])
  })

  it('lists my libraries with effective permissions', async () => {
    const mine = await t.http().get('/api/libraries').set('Cookie', owner.cookie).expect(200)
    expect(mine.body).toHaveLength(1)
    expect(mine.body[0]).toMatchObject({ role: 'owner', library: { id: lib, name: 'Home', homeAiAllowed: false } })
    expect(mine.body[0].permissions).toHaveLength(10)
    const lenderLibs = await t.http().get('/api/libraries').set('Cookie', lender.cookie).expect(200)
    expect(lenderLibs.body[0].permissions).toEqual(['loans.manage'])
  })

  it('hides other libraries completely (404, not 403)', async () => {
    expect((await t.http().get('/api/libraries').set('Cookie', outsider.cookie)).body).toEqual([])
    const res = await t.http().get(`/api/libraries/${lib}/members`).set('Cookie', outsider.cookie).expect(404)
    expect(res.body.code).toBe('not_found')
    await t.http().post(`/api/libraries/${lib}/invites`).set('Cookie', outsider.cookie).send({ permissions: [] }).expect(404)
  })

  it('makes unverified users read-only', async () => {
    const newbie = await signUp(t, 'new@test.local', { verified: false })
    await t.http().get('/api/libraries').set('Cookie', newbie.cookie).expect(200)
    const res = await t.http().post('/api/libraries').set('Cookie', newbie.cookie).send({ name: 'Mine' }).expect(403)
    expect(res.body.code).toBe('email_unverified')
    await t.http().post('/api/invites/accept').set('Cookie', newbie.cookie).send({ code: 'ABCDEFGH' }).expect(403)
  })

  it('validates input with a friendly error', async () => {
    const res = await t.http().post('/api/libraries').set('Cookie', owner.cookie).send({ name: '   ' }).expect(400)
    expect(res.body).toMatchObject({ code: 'invalid_input' })
  })

  it('lets only owners rename or delete a library', async () => {
    const res = await t.http().patch(`/api/libraries/${lib}`).set('Cookie', manager.cookie).send({ name: 'Mine' }).expect(403)
    expect(res.body.code).toBe('owner_only')
    await t.http().patch(`/api/libraries/${lib}`).set('Cookie', owner.cookie).send({ name: 'Family' }).expect(204)
    await t.http().delete(`/api/libraries/${lib}`).set('Cookie', manager.cookie).expect(403)
    await t.http().delete(`/api/libraries/${lib}`).set('Cookie', owner.cookie).expect(204)
    expect(await t.db.prisma.libraryMember.count()).toBe(0)
  })

  describe('invites', () => {
    it('creates, lists, accepts (case/dash-insensitive) and uses them up', async () => {
      const created = await t.http().post(`/api/libraries/${lib}/invites`).set('Cookie', owner.cookie)
        .send({ permissions: ['audits.run'], days: 7, maxUses: 1 }).expect(201)
      expect(created.body.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
      const list = await t.http().get(`/api/libraries/${lib}/invites`).set('Cookie', manager.cookie).expect(200)
      expect(list.body).toHaveLength(1)

      const messy = `${created.body.code.slice(0, 4).toLowerCase()}-${created.body.code.slice(4)}`
      const joined = await t.http().post('/api/invites/accept').set('Cookie', outsider.cookie).send({ code: messy }).expect(200)
      expect(joined.body.libraryId).toBe(lib)
      const libs = await t.http().get('/api/libraries').set('Cookie', outsider.cookie).expect(200)
      expect(libs.body[0].permissions).toEqual(['audits.run'])

      const another = await signUp(t, 'another@test.local')
      const used = await t.http().post('/api/invites/accept').set('Cookie', another.cookie).send({ code: created.body.code }).expect(404)
      expect(used.body.code).toBe('invalid_invite')
      expect((await t.http().get(`/api/libraries/${lib}/invites`).set('Cookie', owner.cookie)).body).toEqual([])
    })

    it('rejects expired codes and does not consume a use for existing members', async () => {
      const created = await t.http().post(`/api/libraries/${lib}/invites`).set('Cookie', owner.cookie).send({ permissions: [], maxUses: 2 }).expect(201)
      await t.http().post('/api/invites/accept').set('Cookie', lender.cookie).send({ code: created.body.code }).expect(200)
      expect((await t.db.prisma.libraryInvite.findFirstOrThrow()).uses).toBe(0)
      await t.db.prisma.libraryInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } })
      await t.http().post('/api/invites/accept').set('Cookie', outsider.cookie).send({ code: created.body.code }).expect(404)
    })

    it('stops managers granting permissions they lack', async () => {
      await t.http().post(`/api/libraries/${lib}/invites`).set('Cookie', manager.cookie).send({ permissions: ['books.add'] }).expect(201)
      const res = await t.http().post(`/api/libraries/${lib}/invites`).set('Cookie', manager.cookie).send({ permissions: ['ai.manage'] }).expect(403)
      expect(res.body).toMatchObject({ code: 'forbidden', permission: 'ai.manage' })
    })

    it('revokes an invite', async () => {
      await t.http().post(`/api/libraries/${lib}/invites`).set('Cookie', owner.cookie).send({ permissions: [] }).expect(201)
      const [invite] = (await t.http().get(`/api/libraries/${lib}/invites`).set('Cookie', owner.cookie)).body
      await t.http().delete(`/api/libraries/${lib}/invites/${invite.id}`).set('Cookie', manager.cookie).expect(204)
      expect(await t.db.prisma.libraryInvite.count()).toBe(0)
    })
  })

  describe('members', () => {
    it('lists members, owners first', async () => {
      const res = await t.http().get(`/api/libraries/${lib}/members`).set('Cookie', lender.cookie).expect(200)
      expect(res.body.map((m: { role: string }) => m.role)).toEqual(['owner', 'member', 'member'])
      expect(res.body[0]).toMatchObject({ userId: owner.id, displayName: 'owner' })
    })

    it('lets managers grant only what they hold, and never touch owners', async () => {
      await t.http().put(`/api/libraries/${lib}/members/${lender.id}/permissions`).set('Cookie', manager.cookie)
        .send({ permissions: ['loans.manage', 'books.add'] }).expect(204)
      const escalate = await t.http().put(`/api/libraries/${lib}/members/${lender.id}/permissions`).set('Cookie', manager.cookie)
        .send({ permissions: ['loans.manage', 'books.add', 'audits.run'] }).expect(403)
      expect(escalate.body.permission).toBe('audits.run')
      // Removing a permission the manager lacks counts as changing it too.
      await t.db.prisma.libraryMember.update({ where: { libraryId_userId: { libraryId: lib, userId: lender.id } }, data: { permissions: ['loansManage', 'aiManage'] } })
      await t.http().put(`/api/libraries/${lib}/members/${lender.id}/permissions`).set('Cookie', manager.cookie)
        .send({ permissions: ['loans.manage'] }).expect(403)
      const owners = await t.http().put(`/api/libraries/${lib}/members/${owner.id}/permissions`).set('Cookie', manager.cookie).send({ permissions: [] }).expect(409)
      expect(owners.body.code).toBe('owner_has_all')
      await t.http().put(`/api/libraries/${lib}/members/${lender.id}/permissions`).set('Cookie', lender.cookie).send({ permissions: [] }).expect(403)
    })

    it('protects owners and the last owner', async () => {
      const res = await t.http().delete(`/api/libraries/${lib}/members/${owner.id}`).set('Cookie', manager.cookie).expect(403)
      expect(res.body.code).toBe('owner_only')
      const last = await t.http().delete(`/api/libraries/${lib}/members/${owner.id}`).set('Cookie', owner.cookie).expect(409)
      expect(last.body.code).toBe('last_owner')
      await t.http().put(`/api/libraries/${lib}/members/${owner.id}/owner`).set('Cookie', owner.cookie).send({ owner: false }).expect(409)
    })

    it('transfers ownership, then the old owner can leave', async () => {
      await t.http().put(`/api/libraries/${lib}/members/${manager.id}/owner`).set('Cookie', manager.cookie).send({ owner: true }).expect(403)
      await t.http().put(`/api/libraries/${lib}/members/${manager.id}/owner`).set('Cookie', owner.cookie).send({ owner: true }).expect(204)
      await t.http().delete(`/api/libraries/${lib}/members/${owner.id}`).set('Cookie', owner.cookie).expect(204)
      const libs = await t.http().get('/api/libraries').set('Cookie', manager.cookie).expect(200)
      expect(libs.body[0].role).toBe('owner')
    })

    it('lets anyone leave and managers remove members', async () => {
      await addMember(t, lib, outsider, [])
      const res = await t.http().delete(`/api/libraries/${lib}/members/${outsider.id}`).set('Cookie', lender.cookie).expect(403)
      expect(res.body.permission).toBe('members.manage')
      await t.http().delete(`/api/libraries/${lib}/members/${outsider.id}`).set('Cookie', manager.cookie).expect(204)
      await t.http().delete(`/api/libraries/${lib}/members/${lender.id}`).set('Cookie', lender.cookie).expect(204)
      await t.http().get(`/api/libraries/${lib}/members`).set('Cookie', lender.cookie).expect(404)
    })

    it('demoted owners keep every permission', async () => {
      await t.http().put(`/api/libraries/${lib}/members/${manager.id}/owner`).set('Cookie', owner.cookie).send({ owner: true }).expect(204)
      await t.http().put(`/api/libraries/${lib}/members/${owner.id}/owner`).set('Cookie', manager.cookie).send({ owner: false }).expect(204)
      const libs = await t.http().get('/api/libraries').set('Cookie', owner.cookie).expect(200)
      expect(libs.body[0]).toMatchObject({ role: 'member' })
      expect(libs.body[0].permissions).toHaveLength(10)
    })
  })

  it('lets only the server admin switch Home AI on', async () => {
    const admin = await signUp(t, 'admin@test.local')
    const res = await t.http().put(`/api/libraries/${lib}/home-ai`).set('Cookie', owner.cookie).send({ allowed: true }).expect(403)
    expect(res.body.code).toBe('admin_only')
    await t.http().put(`/api/libraries/${lib}/home-ai`).set('Cookie', admin.cookie).send({ allowed: true }).expect(204)
    const libs = await t.http().get('/api/libraries').set('Cookie', owner.cookie).expect(200)
    expect(libs.body[0].library.homeAiAllowed).toBe(true)
  })
})
