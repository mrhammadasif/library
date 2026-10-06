// TEST DATA ONLY: fake users, rolled back between tests.
import type { ITestApp } from '../setup/TestApp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lastOtp, signUp } from '../setup/Fixtures'
import { createTestApp, fakeGoogleIdToken, ORIGIN } from '../setup/TestApp'

describe('auth', () => {
  let t: ITestApp

  beforeAll(async () => { t = await createTestApp() })
  afterAll(() => t.close())
  beforeEach(async () => {
    await t.db.reset()
    t.mailbox.length = 0
  })

  it('serves health without a session and rejects anonymous API calls', async () => {
    await t.http().get('/health').expect(200, { ok: true })
    const res = await t.http().get('/api/me').expect(401)
    expect(res.body).toMatchObject({ statusCode: 401, code: 'unauthorized' })
  })

  it('signs up, emails a 6-digit code and verifies with it', async () => {
    const signUpRes = await t.http().post('/api/auth/sign-up/email').set('Origin', ORIGIN)
      .send({ name: 'Olive', email: 'olive@test.local', password: 'correct horse battery' })
      .expect(200)
    expect(t.mailbox).toEqual([expect.objectContaining({ email: 'olive@test.local', type: 'email-verification', otp: expect.stringMatching(/^\d{6}$/) })])

    const before = await t.http().get('/api/me').set('Cookie', signUpRes.headers['set-cookie']).expect(200)
    expect(before.body).toMatchObject({ name: 'Olive', emailVerified: false, isAdmin: false })

    await t.http().post('/api/auth/email-otp/verify-email').set('Origin', ORIGIN)
      .send({ email: 'olive@test.local', otp: lastOtp(t, 'olive@test.local') }).expect(200)
    const after = await t.http().get('/api/me').set('Cookie', signUpRes.headers['set-cookie']).expect(200)
    expect(after.body.emailVerified).toBe(true)
  })

  it('locks a code after 3 wrong attempts', async () => {
    await signUp(t, 'sam@test.local', { verified: false })
    const otp = lastOtp(t, 'sam@test.local', 'email-verification')
    const wrong = otp === '000000' ? '111111' : '000000'
    for (let i = 0; i < 3; i++) {
      await t.http().post('/api/auth/email-otp/verify-email').set('Origin', ORIGIN).send({ email: 'sam@test.local', otp: wrong })
    }
    const res = await t.http().post('/api/auth/email-otp/verify-email').set('Origin', ORIGIN).send({ email: 'sam@test.local', otp })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('signs in with an emailed code and resets a password with one', async () => {
    await signUp(t, 'kid@test.local')
    await t.http().post('/api/auth/email-otp/send-verification-otp').set('Origin', ORIGIN)
      .send({ email: 'kid@test.local', type: 'sign-in' }).expect(200)
    const signIn = await t.http().post('/api/auth/sign-in/email-otp').set('Origin', ORIGIN)
      .send({ email: 'kid@test.local', otp: lastOtp(t, 'kid@test.local', 'sign-in') }).expect(200)
    await t.http().get('/api/me').set('Cookie', signIn.headers['set-cookie']).expect(200)

    await t.http().post('/api/auth/email-otp/request-password-reset').set('Origin', ORIGIN).send({ email: 'kid@test.local' }).expect(200)
    await t.http().post('/api/auth/email-otp/reset-password').set('Origin', ORIGIN)
      .send({ email: 'kid@test.local', otp: lastOtp(t, 'kid@test.local', 'forget-password'), password: 'a brand new password' }).expect(200)
    await t.http().post('/api/auth/sign-in/email').set('Origin', ORIGIN)
      .send({ email: 'kid@test.local', password: 'a brand new password' }).expect(200)
  })

  it('signs in with a Google ID token and links it to a verified account with the same email', async () => {
    const existing = await signUp(t, 'olive@test.local')
    const res = await t.http().post('/api/auth/sign-in/social').set('Origin', ORIGIN)
      .send({ provider: 'google', idToken: { token: fakeGoogleIdToken({ sub: 'google-123', email: 'olive@test.local', name: 'Olive G' }) } })
      .expect(200)
    const me = await t.http().get('/api/me').set('Cookie', res.headers['set-cookie']).expect(200)
    expect(me.body.id).toBe(existing.id)
    const accounts = await t.db.prisma.account.findMany({ where: { userId: existing.id }, orderBy: { providerId: 'asc' } })
    expect(accounts.map(a => a.providerId)).toEqual(['credential', 'google'])
  })

  it('creates a verified account on first Google sign-in', async () => {
    const res = await t.http().post('/api/auth/sign-in/social').set('Origin', ORIGIN)
      .send({ provider: 'google', idToken: { token: fakeGoogleIdToken({ sub: 'google-9', email: 'new@test.local', name: 'New Kid' }) } })
      .expect(200)
    const me = await t.http().get('/api/me').set('Cookie', res.headers['set-cookie']).expect(200)
    expect(me.body).toMatchObject({ email: 'new@test.local', name: 'New Kid', emailVerified: true })
  })

  it('refuses to link Google to an unverified account (someone else may have typed that email)', async () => {
    await signUp(t, 'olive@test.local', { verified: false })
    const res = await t.http().post('/api/auth/sign-in/social').set('Origin', ORIGIN)
      .send({ provider: 'google', idToken: { token: fakeGoogleIdToken({ sub: 'google-123', email: 'olive@test.local' }) } })
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('OAUTH_LINK_ERROR')
  })

  it('rejects Google tokens that fail verification', async () => {
    const token = fakeGoogleIdToken({ sub: 'x', email: 'x@test.local' }).replace('.fake-signature', '.bad')
    const res = await t.http().post('/api/auth/sign-in/social').set('Origin', ORIGIN).send({ provider: 'google', idToken: { token } })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await t.db.prisma.user.count()).toBe(0)
  })

  it('lists devices and signs one out', async () => {
    const phone = await signUp(t, 'olive@test.local')
    const tablet = await t.http().post('/api/auth/sign-in/email').set('Origin', ORIGIN).set('User-Agent', 'Tablet')
      .send({ email: 'olive@test.local', password: 'correct horse battery' }).expect(200)
    const list = await t.http().get('/api/auth/list-sessions').set('Cookie', phone.cookie).expect(200)
    expect(list.body).toHaveLength(2)
    const tabletSession = list.body.find((s: { userAgent: string }) => s.userAgent === 'Tablet')
    await t.http().post('/api/auth/revoke-session').set('Origin', ORIGIN).set('Cookie', phone.cookie).send({ token: tabletSession.token }).expect(200)
    await t.http().get('/api/me').set('Cookie', tablet.headers['set-cookie']).expect(401)
    await t.http().get('/api/me').set('Cookie', phone.cookie).expect(200)
  })

  it('marks configured admins', async () => {
    const admin = await signUp(t, 'admin@test.local')
    const me = await t.http().get('/api/me').set('Cookie', admin.cookie).expect(200)
    expect(me.body.isAdmin).toBe(true)
  })

  it('deletes an account, removing solo libraries and keeping loan names', async () => {
    const olive = await signUp(t, 'olive@test.local')
    const lib = await t.db.prisma.library.create({ data: { name: 'Solo', members: { create: { userId: olive.id, role: 'owner' } } } })
    await t.http().post('/api/auth/delete-user').set('Origin', ORIGIN).set('Cookie', olive.cookie).send({}).expect(200)
    expect(await t.db.prisma.user.count()).toBe(0)
    expect(await t.db.prisma.library.findUnique({ where: { id: lib.id } })).toBeNull()
  })

  it('blocks deleting the last owner of a shared library', async () => {
    const olive = await signUp(t, 'olive@test.local')
    const sam = await signUp(t, 'sam@test.local')
    await t.db.prisma.library.create({ data: { name: 'Family', members: { create: [{ userId: olive.id, role: 'owner' }, { userId: sam.id, role: 'member' }] } } })
    const res = await t.http().post('/api/auth/delete-user').set('Origin', ORIGIN).set('Cookie', olive.cookie).send({})
    expect(res.status).toBe(409)
    expect(JSON.stringify(res.body)).toContain('Family')
    expect(await t.db.prisma.user.count()).toBe(2)
  })
})
