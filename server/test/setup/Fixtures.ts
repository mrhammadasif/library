// TEST DATA ONLY. Users and sessions for e2e tests.
import type { Permission } from '../../../shared/permissions'
import type { ITestApp } from './TestApp'
import { toEnumPermission } from '../../src/common/PermissionMap'
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

/** Inserts a membership directly (fast setup for permission tests). */
export async function addMember(t: ITestApp, libraryId: string, user: ITestUser, permissions: Permission[] = [], role: 'owner' | 'member' = 'member') {
  await t.db.prisma.libraryMember.create({ data: { libraryId, userId: user.id, role, permissions: permissions.map(toEnumPermission) } })
}

/** A library owned by `owner`, created through the API. */
export async function createLibrary(t: ITestApp, owner: ITestUser, name = 'Home'): Promise<string> {
  const res = await t.http().post('/api/libraries').set('Cookie', owner.cookie).send({ name })
  if (res.status !== 201) {
    throw new Error(`create library failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body.id
}
