// Transactional email for one-time codes. Table layout + inline styles so it renders the same in Gmail, Outlook and
// Apple Mail; no images (often blocked), so the brand is a text wordmark. Every interpolated value is escaped.

export type OtpType = 'email-verification' | 'sign-in' | 'forget-password' | 'change-email'

interface ICopy {
  subject: (otp: string) => string
  heading: string
  intro: string
  /** Footer: why this address got the email. */
  reason: string
}

const COPY: Record<OtpType, ICopy> = {
  'email-verification': {
    subject: otp => `${otp} is your Home Library verification code`,
    heading: 'Confirm your email',
    intro: 'Welcome to Home Library! Enter this code in the app to confirm your email address and finish setting up your account.',
    reason: 'a Home Library account was created with this address',
  },
  'sign-in': {
    subject: otp => `${otp} is your Home Library sign-in code`,
    heading: 'Your sign-in code',
    intro: 'Enter this code in the Home Library app to sign in. No password needed.',
    reason: 'someone asked to sign in to Home Library with this address',
  },
  'forget-password': {
    subject: otp => `${otp} is your Home Library password reset code`,
    heading: 'Reset your password',
    intro: 'We received a request to reset your Home Library password. Enter this code in the app, then choose a new password.',
    reason: 'someone asked to reset the Home Library password for this address',
  },
  'change-email': {
    subject: otp => `${otp} is your code to confirm your new email`,
    heading: 'Confirm your new email',
    intro: 'Enter this code in the Home Library app to confirm this as your new email address.',
    reason: 'someone asked to move a Home Library account to this address',
  },
}

const BRAND = {
  canvas: '#F7F4EE',
  card: '#FFFFFF',
  line: '#EBE5DA',
  primary: '#2F5D50',
  primarySoft: '#E3EEE9',
  ink: '#1F1A14',
  muted: '#6F665C',
  faint: '#A39A8F',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)
}

function copyFor(type: string): ICopy {
  return COPY[type as OtpType] ?? COPY['email-verification']
}

export interface IOtpEmail {
  subject: string
  html: string
  text: string
}

/** Subject, HTML and plain-text bodies for a code email. `minutes` is how long the code works. */
export function renderOtpEmail({ otp, type, email, minutes = 5 }: { otp: string, type: string, email: string, minutes?: number }): IOtpEmail {
  const copy = copyFor(type)
  const code = escapeHtml(otp)
  const to = escapeHtml(email)
  const font = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
  const mono = `'SF Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(copy.heading)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background-color: #1A1714 !important; }
    .card { background-color: #24201C !important; border-color: #3A332C !important; }
    .ink { color: #F2EDE6 !important; }
    .muted { color: #B8AFA4 !important; }
    .codebox { background-color: #1F3A33 !important; border-color: #2F5D50 !important; }
    .code { color: #F2EDE6 !important; }
    .rule { border-color: #3A332C !important; }
  }
  @media (max-width: 600px) {
    .pad { padding-left: 24px !important; padding-right: 24px !important; }
    .code { font-size: 34px !important; letter-spacing: 8px !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:${BRAND.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your code is ${code}. It works for ${minutes} minutes.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.canvas};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 4px 20px 4px;font-family:${font};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${BRAND.primary};border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;font-size:22px;line-height:40px;">&#128218;</td>
                <td class="ink" style="padding-left:12px;font-size:20px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.2px;">Home Library</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="card" style="background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="pad" style="padding:40px 40px 8px 40px;font-family:${font};">
                  <h1 class="ink" style="margin:0 0 12px 0;font-size:26px;line-height:32px;font-weight:700;color:${BRAND.ink};">${escapeHtml(copy.heading)}</h1>
                  <p class="muted" style="margin:0;font-size:16px;line-height:24px;color:${BRAND.muted};">${escapeHtml(copy.intro)}</p>
                </td>
              </tr>
              <tr>
                <td class="pad" style="padding:28px 40px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td class="codebox" align="center" style="background-color:${BRAND.primarySoft};border:1px solid #C9DDD3;border-radius:12px;padding:22px 12px;">
                        <div class="code" style="font-family:${mono};font-size:40px;line-height:48px;font-weight:700;letter-spacing:12px;color:${BRAND.ink};padding-left:12px;">${code}</div>
                      </td>
                    </tr>
                  </table>
                  <p class="muted" style="margin:14px 0 0 0;font-family:${font};font-size:14px;line-height:20px;color:${BRAND.muted};text-align:center;">This code expires in <strong>${minutes} minutes</strong> and can only be used once.</p>
                </td>
              </tr>
              <tr>
                <td class="pad" style="padding:0 40px 36px 40px;font-family:${font};">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="rule" style="border-top:1px solid ${BRAND.line};font-size:0;line-height:0;">&nbsp;</td></tr></table>
                  <p class="muted" style="margin:20px 0 0 0;font-size:14px;line-height:21px;color:${BRAND.muted};">
                    <strong class="ink" style="color:${BRAND.ink};">Didn't ask for this?</strong> You can safely ignore this email; nothing changes until the code is entered.
                    Never share this code with anyone. Home Library will never ask you for it.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 8px 0 8px;font-family:${font};text-align:center;">
            <p style="margin:0;font-size:12px;line-height:18px;color:${BRAND.faint};">
              This email was sent to ${to} because ${escapeHtml(copy.reason)}.<br>
              Home Library &middot; Every book on every shelf, one scan away.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`

  const text = [
    `${copy.heading}`,
    '',
    copy.intro,
    '',
    `Your code: ${otp}`,
    '',
    `This code expires in ${minutes} minutes and can only be used once.`,
    '',
    `Didn't ask for this? You can safely ignore this email. Never share this code; Home Library will never ask you for it.`,
    '',
    `This email was sent to ${email} because ${copy.reason}.`,
  ].join('\n')

  return { subject: copy.subject(otp), html, text }
}
