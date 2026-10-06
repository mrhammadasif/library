import { Resend } from 'resend'
import { renderOtpEmail } from './OtpEmail'

export interface IOtpMail {
  email: string
  otp: string
  type: string
}

export interface IMailer {
  sendOtp: (mail: IOtpMail) => Promise<void>
}

/** Code emails via Resend. Codes live 5 minutes (emailOTP `expiresIn: 300` in CreateAuth). */
export function createResendMailer(apiKey: string, from: string): IMailer {
  const resend = new Resend(apiKey)
  return {
    async sendOtp({ email, otp, type }) {
      const { subject, html, text } = renderOtpEmail({ otp, type, email, minutes: 5 })
      const { error } = await resend.emails.send({ from, to: email, subject, html, text })
      if (error) {
        throw new Error(`Email not sent: ${error.message}`)
      }
    },
  }
}
