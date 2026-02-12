import { describe, it, expect } from 'vitest'
import {
  detectAtsType,
  normalizeJobUrl,
  generateCompanyTitleHash,
  urlsMatch,
  extractJobId,
} from './url-normalizer'

describe('detectAtsType', () => {
  it('detects greenhouse', () => {
    expect(detectAtsType('boards.greenhouse.io', '/company/jobs/123')).toBe('greenhouse')
  })

  it('detects lever', () => {
    expect(detectAtsType('jobs.lever.co', '/company/uuid')).toBe('lever')
  })

  it('detects workday', () => {
    expect(detectAtsType('company.myworkdayjobs.com', '/en-US/job/123')).toBe('workday')
  })

  it('detects ashby', () => {
    expect(detectAtsType('jobs.ashbyhq.com', '/company/job-uuid')).toBe('ashby')
  })

  it('detects linkedin', () => {
    expect(detectAtsType('linkedin.com', '/jobs/view/123456')).toBe('linkedin')
  })

  it('detects indeed', () => {
    expect(detectAtsType('indeed.com', '/viewjob?jk=abc123')).toBe('indeed')
  })

  it('returns null for unknown domains', () => {
    expect(detectAtsType('example.com', '/careers')).toBeNull()
  })
})

describe('normalizeJobUrl', () => {
  it('lowercases and removes trailing slashes', () => {
    const result = normalizeJobUrl('https://Company.com/Jobs/123/')
    expect(result.normalized).toBe('company.com/jobs/123')
  })

  it('removes www prefix', () => {
    const result = normalizeJobUrl('https://www.company.com/jobs/123')
    expect(result.domain).toBe('company.com')
  })

  it('strips query params by default', () => {
    const result = normalizeJobUrl('https://company.com/jobs/123?utm_source=google&ref=abc')
    expect(result.normalized).toBe('company.com/jobs/123')
  })

  it('preserves essential workday params', () => {
    const result = normalizeJobUrl(
      'https://company.myworkdayjobs.com/en-US/careers?jobRequisitionId=R12345&utm=abc'
    )
    expect(result.normalized).toContain('jobRequisitionId=R12345')
    expect(result.normalized).not.toContain('utm')
  })

  it('preserves indeed jk param', () => {
    const result = normalizeJobUrl('https://indeed.com/viewjob?jk=abc123&from=serp')
    expect(result.normalized).toContain('jk=abc123')
    expect(result.normalized).not.toContain('from')
  })

  it('handles malformed URLs gracefully', () => {
    const result = normalizeJobUrl('not-a-url')
    expect(result.normalized).toBe('not-a-url')
    expect(result.domain).toBe('')
    expect(result.atsType).toBeNull()
  })

  it('sets atsType correctly', () => {
    const gh = normalizeJobUrl('https://boards.greenhouse.io/company/jobs/123')
    expect(gh.atsType).toBe('greenhouse')
  })
})

describe('generateCompanyTitleHash', () => {
  it('produces consistent hashes', () => {
    const a = generateCompanyTitleHash('Acme Corp', 'Senior Engineer')
    const b = generateCompanyTitleHash('Acme Corp', 'Senior Engineer')
    expect(a).toBe(b)
  })

  it('is case-insensitive', () => {
    const lower = generateCompanyTitleHash('acme corp', 'senior engineer')
    const upper = generateCompanyTitleHash('ACME CORP', 'SENIOR ENGINEER')
    expect(lower).toBe(upper)
  })

  it('ignores extra whitespace', () => {
    const normal = generateCompanyTitleHash('Acme Corp', 'Senior Engineer')
    const spaced = generateCompanyTitleHash('  Acme  Corp  ', '  Senior  Engineer  ')
    expect(normal).toBe(spaced)
  })

  it('produces different hashes for different inputs', () => {
    const a = generateCompanyTitleHash('Acme', 'Engineer')
    const b = generateCompanyTitleHash('Beta', 'Designer')
    expect(a).not.toBe(b)
  })
})

describe('urlsMatch', () => {
  it('matches identical URLs', () => {
    expect(urlsMatch(
      'https://company.com/jobs/123',
      'https://company.com/jobs/123'
    )).toBe(true)
  })

  it('matches with different casing', () => {
    expect(urlsMatch(
      'https://Company.com/Jobs/123',
      'https://company.com/jobs/123'
    )).toBe(true)
  })

  it('matches when one has trailing slash', () => {
    expect(urlsMatch(
      'https://company.com/jobs/123/',
      'https://company.com/jobs/123'
    )).toBe(true)
  })

  it('does not match different jobs', () => {
    expect(urlsMatch(
      'https://company.com/jobs/123',
      'https://company.com/jobs/456'
    )).toBe(false)
  })

  it('does not match different domains', () => {
    expect(urlsMatch(
      'https://company-a.com/jobs/123',
      'https://company-b.com/jobs/123'
    )).toBe(false)
  })
})

describe('extractJobId', () => {
  it('extracts greenhouse job ID', () => {
    expect(extractJobId('https://boards.greenhouse.io/company/jobs/456789')).toBe('456789')
  })

  it('extracts lever job UUID', () => {
    const uuid = '12345678-1234-1234-1234-123456789abc'
    expect(extractJobId(`https://jobs.lever.co/company/${uuid}`)).toBe(uuid)
  })

  it('extracts workday jobRequisitionId', () => {
    expect(extractJobId(
      'https://company.myworkdayjobs.com/en-US/careers?jobRequisitionId=R12345'
    )).toBe('R12345')
  })

  it('extracts linkedin job ID', () => {
    expect(extractJobId('https://linkedin.com/jobs/view/123456789')).toBe('123456789')
  })

  it('extracts indeed jk', () => {
    expect(extractJobId('https://indeed.com/viewjob?jk=abc123')).toBe('abc123')
  })

  it('returns null for unknown ATS', () => {
    expect(extractJobId('https://example.com/careers/job-123')).toBeNull()
  })

  it('returns null for malformed URLs', () => {
    expect(extractJobId('not-a-url')).toBeNull()
  })
})
