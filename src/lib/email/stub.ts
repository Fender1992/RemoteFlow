import type { Job } from '@/types'

// Stub email implementation for MVP
// Replace with SendGrid in production

export async function sendWeeklyDigest(
  toEmail: string,
  userName: string | null,
  jobs: Job[]
): Promise<void> {
  console.log('=== EMAIL DIGEST (STUBBED) ===')
  console.log(`To: ${toEmail}`)
  console.log(`User: ${userName || 'User'}`)
  console.log(`Jobs count: ${jobs.length}`)
  console.log('Jobs:')
  jobs.slice(0, 5).forEach((job, i) => {
    console.log(`  ${i + 1}. ${job.title} at ${job.company}`)
  })
  if (jobs.length > 5) {
    console.log(`  ... and ${jobs.length - 5} more`)
  }
  console.log('=== END EMAIL DIGEST ===')
}

export async function sendWelcomeEmail(
  toEmail: string,
  userName: string | null
): Promise<void> {
  console.log('=== WELCOME EMAIL (STUBBED) ===')
  console.log(`To: ${toEmail}`)
  console.log(`User: ${userName || 'User'}`)
  console.log('Message: Welcome to RemoteFlow! Start exploring remote jobs.')
  console.log('=== END WELCOME EMAIL ===')
}
