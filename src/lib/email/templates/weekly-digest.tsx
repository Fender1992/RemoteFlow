import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { Job } from '@/types'

interface WeeklyDigestEmailProps {
  userName: string
  jobs: Job[]
}

export function WeeklyDigestEmail({ userName, jobs }: WeeklyDigestEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jobiq.app'

  return (
    <Html>
      <Head />
      <Preview>{`${jobs.length} new remote jobs matching your preferences`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Your Weekly Job Digest</Heading>
          <Text style={text}>
            Hi {userName}, here are {jobs.length} new remote jobs that match your preferences this week:
          </Text>

          {jobs.map((job, index) => (
            <Section key={job.id || index} style={jobCard}>
              <Text style={jobTitle}>
                <Link href={`${appUrl}/jobs/${job.id}`} style={jobLink}>
                  {job.title}
                </Link>
              </Text>
              <Text style={jobCompany}>{job.company}</Text>
              <Text style={jobMeta}>
                {job.salary_min && job.salary_max
                  ? `$${(job.salary_min / 1000).toFixed(0)}k - $${(job.salary_max / 1000).toFixed(0)}k`
                  : 'Salary not listed'}
                {job.job_type ? ` · ${job.job_type.replace('_', ' ')}` : ''}
              </Text>
            </Section>
          ))}

          <Section style={ctaSection}>
            <Link href={`${appUrl}/jobs`} style={button}>
              View All Jobs
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            You&apos;re receiving this because you enabled weekly digests in your JobIQ preferences.
            <br />
            <Link href={`${appUrl}/preferences`} style={unsubLink}>
              Update preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '560px',
  borderRadius: '8px',
}

const h1 = {
  color: '#1a1a2e',
  fontSize: '24px',
  fontWeight: '700' as const,
  margin: '0 0 20px',
}

const text = {
  color: '#4a5568',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '0 0 16px',
}

const jobCard = {
  padding: '12px 16px',
  borderLeft: '3px solid #4f46e5',
  marginBottom: '12px',
  backgroundColor: '#fafafa',
  borderRadius: '0 6px 6px 0',
}

const jobTitle = { margin: '0 0 2px' }
const jobLink = {
  color: '#1a1a2e',
  fontSize: '16px',
  fontWeight: '600' as const,
  textDecoration: 'none',
}
const jobCompany = {
  color: '#4a5568',
  fontSize: '14px',
  margin: '0 0 2px',
}
const jobMeta = {
  color: '#a0aec0',
  fontSize: '13px',
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const button = {
  backgroundColor: '#4f46e5',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600' as const,
  padding: '12px 32px',
  textDecoration: 'none',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
}

const footer = {
  color: '#a0aec0',
  fontSize: '12px',
  textAlign: 'center' as const,
  lineHeight: '20px',
}

const unsubLink = {
  color: '#a0aec0',
  textDecoration: 'underline',
}
