import { describe, expect, it } from 'vitest'
import { escapeHtml, renderOtpEmail } from '../../src/email/OtpEmail'

describe('otpEmail', () => {
  it.each([
    ['email-verification', '246810 is your Home Library verification code', 'Confirm your email'],
    ['sign-in', '246810 is your Home Library sign-in code', 'Your sign-in code'],
    ['forget-password', '246810 is your Home Library password reset code', 'Reset your password'],
    ['change-email', '246810 is your code to confirm your new email', 'Confirm your new email'],
  ])('%s: code-first subject, heading, code in both bodies', (type, subject, heading) => {
    const mail = renderOtpEmail({ otp: '246810', type, email: 'kid@test.local' })
    expect(mail.subject).toBe(subject)
    expect(mail.html).toContain(heading)
    expect(mail.html).toContain('>246810<')
    expect(mail.html).toContain('Your code is 246810') // inbox preview text
    expect(mail.text).toContain('Your code: 246810')
    expect(mail.text).toContain('expires in 5 minutes')
  })

  it('falls back to the verification copy for unknown types', () => {
    expect(renderOtpEmail({ otp: '111111', type: 'whatever', email: 'a@b.c' }).subject).toContain('verification code')
  })

  it('escapes the recipient address', () => {
    const mail = renderOtpEmail({ otp: '123456', type: 'sign-in', email: '"><script>x</script>@evil.test' })
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })

  it('is a self-contained table layout (no images, no external CSS)', () => {
    const { html } = renderOtpEmail({ otp: '123456', type: 'sign-in', email: 'a@b.c' })
    expect(html).not.toMatch(/<img|<link /)
    expect(html).toContain('role="presentation"')
    expect(html).toContain('prefers-color-scheme: dark')
  })
})
