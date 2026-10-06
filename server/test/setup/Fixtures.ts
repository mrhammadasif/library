// TEST DATA ONLY. Users and sessions for e2e tests.
import type { ITestApp } from './TestApp'
import { ORIGIN } from './TestApp'

export interface ITestUser {
  id: string
  email: string
  cookie: string[]
}

/** Signs up through Better Auth; marks the email verified directly unless `verified: false`. */
export async function signUp(t: ITestApp, email: string, { verified = true, name = email.split('@')[0] } = {}): Promise<ITestUser> {
  const res = await t.http().post('/api/auth/sign-up/email').set('Origin', ORIGIN).send({ name, email, password: 'correct horse battery' })
  if (res.status !== 200) {
    throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  const user = await t.db.prisma.user.findUniqueOrThrow({ where: { email } })
  if (verified) {
    await t.db.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } })
  }
  return { id: user.id, email, cookie: res.headers['set-cookie'] as unknown as string[] }
}

export function lastOtp(t: ITestApp, email: string, type?: string): string {
  const mail = [...t.mailbox].reverse().find(m => m.email === email && (!type || m.type === type))
  if (!mail) {
    throw new Error(`no ${type ?? ''} OTP for ${email}`)
  }
  return mail.otp
}
