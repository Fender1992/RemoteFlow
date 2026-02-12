import { describe, it, expect } from 'vitest'
import { normalizeRemotiveJob, normalizeRemotiveJobs } from './normalize'
import type { RemotiveJob } from '@/types'

function makeJob(overrides: Partial<RemotiveJob> = {}): RemotiveJob {
  return {
    id: 1,
    title: 'Senior Engineer',
    company_name: 'Acme Corp',
    company_logo: 'https://logo.com/acme.png',
    url: 'https://remotive.com/jobs/1',
    description: 'Great job description',
    salary: '',
    job_type: 'full_time',
    publication_date: '2025-01-15T00:00:00Z',
    candidate_required_location: 'US',
    tags: ['react', 'typescript'],
    category: 'Software Development',
    ...overrides,
  } as RemotiveJob
}

describe('normalizeRemotiveJob', () => {
  it('normalizes basic fields', () => {
    const result = normalizeRemotiveJob(makeJob())
    expect(result.title).toBe('Senior Engineer')
    expect(result.company).toBe('Acme Corp')
    expect(result.source).toBe('remotive')
    expect(result.is_active).toBe(true)
    expect(result.timezone).toBe('US')
    expect(result.tech_stack).toEqual(['react', 'typescript'])
  })

  it('trims title and company name', () => {
    const result = normalizeRemotiveJob(makeJob({
      title: '  Padded Title  ',
      company_name: '  Padded Co  ',
    }))
    expect(result.title).toBe('Padded Title')
    expect(result.company).toBe('Padded Co')
  })

  it('normalizes job types', () => {
    expect(normalizeRemotiveJob(makeJob({ job_type: 'full_time' })).job_type).toBe('full_time')
    expect(normalizeRemotiveJob(makeJob({ job_type: 'full-time' })).job_type).toBe('full_time')
    expect(normalizeRemotiveJob(makeJob({ job_type: 'part_time' })).job_type).toBe('part_time')
    expect(normalizeRemotiveJob(makeJob({ job_type: 'contract' })).job_type).toBe('contract')
    expect(normalizeRemotiveJob(makeJob({ job_type: 'freelance' })).job_type).toBe('freelance')
    expect(normalizeRemotiveJob(makeJob({ job_type: 'internship' })).job_type).toBe('internship')
    expect(normalizeRemotiveJob(makeJob({ job_type: 'unknown_type' })).job_type).toBeNull()
  })

  it('infers experience level from title', () => {
    expect(normalizeRemotiveJob(makeJob({ title: 'Senior Engineer' })).experience_level).toBe('senior')
    expect(normalizeRemotiveJob(makeJob({ title: 'Junior Developer' })).experience_level).toBe('junior')
    expect(normalizeRemotiveJob(makeJob({ title: 'Staff Engineer' })).experience_level).toBe('lead')
    expect(normalizeRemotiveJob(makeJob({ title: 'Principal Architect' })).experience_level).toBe('lead')
    expect(normalizeRemotiveJob(makeJob({ title: 'Mid-Level Designer' })).experience_level).toBe('mid')
    expect(normalizeRemotiveJob(makeJob({ title: 'Software Engineer' })).experience_level).toBe('any')
  })

  it('parses salary range', () => {
    const result = normalizeRemotiveJob(makeJob({ salary: '$80,000 - $120,000' }))
    expect(result.salary_min).toBe(80000)
    expect(result.salary_max).toBe(120000)
    expect(result.currency).toBe('USD')
  })

  it('parses k notation salary', () => {
    const result = normalizeRemotiveJob(makeJob({ salary: '80k - 120k' }))
    expect(result.salary_min).toBe(80000)
    expect(result.salary_max).toBe(120000)
  })

  it('parses hourly salary and converts to annual', () => {
    const result = normalizeRemotiveJob(makeJob({ salary: '$50/hour' }))
    expect(result.salary_min).toBe(50 * 2080)
  })

  it('detects EUR currency', () => {
    const result = normalizeRemotiveJob(makeJob({ salary: '€60,000 - €80,000' }))
    expect(result.currency).toBe('EUR')
  })

  it('returns null salary for empty salary string', () => {
    const result = normalizeRemotiveJob(makeJob({ salary: '' }))
    expect(result.salary_min).toBeNull()
    expect(result.salary_max).toBeNull()
  })

  it('returns null description for falsy description', () => {
    const result = normalizeRemotiveJob(makeJob({ description: '' }))
    expect(result.description).toBeNull()
  })

  it('defaults to global timezone when candidate_required_location is empty', () => {
    // Empty string is falsy, so || 'global' kicks in
    const result = normalizeRemotiveJob(makeJob({ candidate_required_location: '' }))
    expect(result.timezone).toBe('global')
  })
})

describe('normalizeRemotiveJobs', () => {
  it('normalizes an array of jobs', () => {
    const jobs = [makeJob({ title: 'Job A' }), makeJob({ title: 'Job B' })]
    const results = normalizeRemotiveJobs(jobs)
    expect(results).toHaveLength(2)
    expect(results[0].title).toBe('Job A')
    expect(results[1].title).toBe('Job B')
  })
})
