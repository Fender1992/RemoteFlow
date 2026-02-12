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

interface WelcomeEmailProps {
  userName: string
}

export function WelcomeEmail({ userName }: WelcomeEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jobiq.app'

  return (
    <Html>
      <Head />
      <Preview>Welcome to JobIQ - your intelligent remote job companion</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to JobIQ, {userName}!</Heading>
          <Text style={text}>
            You now have access to the smartest way to find and track remote jobs.
            Here&apos;s what you can do:
          </Text>

          <Section style={featureSection}>
            <Text style={featureTitle}>Browse Quality-Scored Jobs</Text>
            <Text style={featureDesc}>
              Every job listing is scored for quality and checked for ghost job indicators.
              Focus on real opportunities.
            </Text>
          </Section>

          <Section style={featureSection}>
            <Text style={featureTitle}>Track Your Applications</Text>
            <Text style={featureDesc}>
              Use the Kanban pipeline to move jobs from Saved to Applied to Offer.
              Never lose track of where you stand.
            </Text>
          </Section>

          <Section style={featureSection}>
            <Text style={featureTitle}>Company Intelligence</Text>
            <Text style={featureDesc}>
              See company credibility grades, response rates, and hiring trends
              before you apply.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Link href={`${appUrl}/jobs`} style={button}>
              Start Browsing Jobs
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            JobIQ - Know Before You Apply
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

const featureSection = {
  margin: '0 0 16px',
  padding: '16px',
  backgroundColor: '#f7fafc',
  borderRadius: '6px',
}

const featureTitle = {
  color: '#1a1a2e',
  fontSize: '16px',
  fontWeight: '600' as const,
  margin: '0 0 4px',
}

const featureDesc = {
  color: '#718096',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
}

const ctaSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
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
}
