import { getResendClient, getFromAddress } from './client'
import { WelcomeEmail } from './templates/welcome'
import { WeeklyDigestEmail } from './templates/weekly-digest'
import type { Job } from '@/types'

export async function sendWelcomeEmail(
  toEmail: string,
  userName: string | null
): Promise<void> {
  const resend = getResendClient()
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: toEmail,
    subject: 'Welcome to JobIQ - Know Before You Apply',
    react: WelcomeEmail({ userName: userName || 'there' }),
  })
  if (error) {
    console.error('Failed to send welcome email:', error)
    throw new Error(`Failed to send welcome email: ${error.message}`)
  }
}

export async function sendWeeklyDigest(
  toEmail: string,
  userName: string | null,
  jobs: Job[]
): Promise<void> {
  const resend = getResendClient()
  const { error } = await resend.emails.send({
    from: getFromAddress(),
    to: toEmail,
    subject: `${jobs.length} new remote jobs this week - JobIQ`,
    react: WeeklyDigestEmail({
      userName: userName || 'there',
      jobs: jobs.slice(0, 10),
    }),
  })
  if (error) {
    console.error('Failed to send weekly digest:', error)
    throw new Error(`Failed to send weekly digest: ${error.message}`)
  }
}
