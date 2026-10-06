import { Resend } from 'resend'

export interface IOtpMail {
  email: string
  otp: string
  type: string
}

export interface IMailer {
  sendOtp: (mail: IOtpMail) => Promise<void>
}

const SUBJECTS: Record<string, string> = {
  'email-verification': 'Your Home Library code',
  'sign-in': 'Your Home Library sign-in code',
  'forget-password': 'Reset your Home Library password',
  'change-email': 'Confirm your new email',
}

/** Plain, readable code email: big digits, nothing to click. */
export function otpEmailHtml(otp: string, type: string): string {
  const purpose = type === 'forget-password' ? 'reset your password' : type === 'sign-in' ? 'sign in' : 'confirm your email'
  return `<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1f1a14">
<h2 style="margin:0 0 8px">📚 Home Library</h2>
<p>Type this code in the app to ${purpose}:</p>
<p style="font-size:36px;font-weight:700;letter-spacing:8px;margin:16px 0">${otp}</p>
<p style="color:#6f665c">It works for 5 minutes. If you didn't ask for it, you can ignore this email.</p></div>`
}

export function createResendMailer(apiKey: string, from: string): IMailer {
  const resend = new Resend(apiKey)
  return {
    async sendOtp({ email, otp, type }) {
      const { error } = await resend.emails.send({
        from,
        to: email,
        subject: SUBJECTS[type] ?? 'Your Home Library code',
        html: otpEmailHtml(otp, type),
        text: `Your Home Library code is ${otp}. It works for 5 minutes.`,
      })
      if (error) {
        throw new Error(`Email not sent: ${error.message}`)
      }
    },
  }
}
