import type { INestApplication } from '@nestjs/common'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { Test } from '@nestjs/testing'
import { execFileSync } from 'node:child_process'
import { PrismaPGlite } from 'pglite-prisma-adapter'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app/AppModule'
import { createAuth } from '../../src/auth/CreateAuth'
import { PrismaClient } from '../../src/generated/prisma/client'

// Phase 0 spike: Better Auth email+password sign-up → emailed OTP → verify → session cookie → guarded Nest route, on PGlite.
describe('better auth otp spike', () => {
  const mailbox: { email: string, otp: string, type: string }[] = []
  let app: INestApplication

  beforeAll(async () => {
    const pglite = await PGlite.create({ extensions: { pg_trgm } })
    await pglite.exec('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await pglite.exec(execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' }))
    const prisma = new PrismaClient({ adapter: new PrismaPGlite(pglite) })
    const auth = createAuth({
      prisma,
      sendOtp: async (mail) => { mailbox.push(mail) },
      secret: 'test-secret-test-secret-test-secret-123',
      baseUrl: 'http://localhost:3000',
    })
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ prisma, auth })] }).compile()
    app = moduleRef.createNestApplication({ bodyParser: false })
    await app.init()
  })

  afterAll(() => app?.close())

  it('signs up, verifies by code and reaches a guarded route', async () => {
    const http = request(app.getHttpServer())
    await http.get('/api/me').expect(401)

    const signUp = await http.post('/api/auth/sign-up/email').set('Origin', 'homelibrary://')
      .send({ name: 'Olive', email: 'olive@test.local', password: 'correct horse battery' })
    expect(signUp.status).toBe(200)
    expect(mailbox).toHaveLength(1)
    expect(mailbox[0]).toMatchObject({ email: 'olive@test.local', type: 'email-verification' })
    expect(mailbox[0].otp).toMatch(/^\d{6}$/)

    const cookie = signUp.headers['set-cookie']
    const before = await http.get('/api/me').set('Cookie', cookie).expect(200)
    expect(before.body.emailVerified).toBe(false)

    await http.post('/api/auth/email-otp/verify-email').set('Origin', 'homelibrary://')
      .send({ email: 'olive@test.local', otp: '000000' }).expect(res => expect(res.status).toBeGreaterThanOrEqual(400))
    const verify = await http.post('/api/auth/email-otp/verify-email').set('Origin', 'homelibrary://')
      .send({ email: 'olive@test.local', otp: mailbox[0].otp })
    expect(verify.status).toBe(200)

    const signIn = await http.post('/api/auth/sign-in/email').set('Origin', 'homelibrary://')
      .send({ email: 'olive@test.local', password: 'correct horse battery' })
    expect(signIn.status).toBe(200)
    const after = await http.get('/api/me').set('Cookie', signIn.headers['set-cookie']).expect(200)
    expect(after.body).toMatchObject({ email: 'olive@test.local', emailVerified: true })
  })
})
