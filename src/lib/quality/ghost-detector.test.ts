import { describe, it, expect } from 'vitest'
import {
  getDaysOpen,
  isGenericApplyLink,
  detectGhostIndicators,
} from './ghost-detector'

describe('getDaysOpen', () => {
  it('returns 0 for null date', () => {
    expect(getDaysOpen(null)).toBe(0)
  })

  it('returns 0 for today', () => {
    expect(getDaysOpen(new Date().toISOString())).toBe(0)
  })

  it('returns correct days for past dates', () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    expect(getDaysOpen(sevenDaysAgo)).toBe(7)
  })
})

describe('isGenericApplyLink', () => {
  it('detects generic careers page', () => {
    expect(isGenericApplyLink('https://company.com/careers/')).toBe(true)
    expect(isGenericApplyLink('https://company.com/jobs/')).toBe(true)
  })

  it('does not flag specific job links', () => {
    expect(isGenericApplyLink('https://company.com/jobs/senior-engineer-12345')).toBe(false)
  })
})

describe('detectGhostIndicators', () => {
  it('returns 0 score for healthy job', () => {
    const result = detectGhostIndicators({
      posted_date: new Date().toISOString(),
      repost_count: 1,
      salary_min: 80000,
      salary_max: 100000,
      description: 'A'.repeat(600),
      url: 'https://company.com/jobs/12345',
    })
    expect(result.ghostScore).toBe(0)
    expect(result.ghostFlags).toHaveLength(0)
  })

  it('flags jobs open > 90 days', () => {
    const result = detectGhostIndicators({
      posted_date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      salary_min: 80000,
      salary_max: 100000,
      description: 'A'.repeat(600),
      url: 'https://company.com/jobs/12345',
    })
    expect(result.ghostFlags).toContain('open_90_days')
    expect(result.ghostScore).toBeGreaterThanOrEqual(3)
  })

  it('flags jobs reposted 4+ times', () => {
    const result = detectGhostIndicators({
      posted_date: new Date().toISOString(),
      repost_count: 5,
      salary_min: 80000,
      salary_max: 100000,
      description: 'A'.repeat(600),
      url: 'https://company.com/jobs/12345',
    })
    expect(result.ghostFlags).toContain('reposted_4_plus')
  })

  it('flags short descriptions', () => {
    const result = detectGhostIndicators({
      posted_date: new Date().toISOString(),
      salary_min: 80000,
      salary_max: 100000,
      description: 'Short desc',
      url: 'https://company.com/jobs/12345',
    })
    expect(result.ghostFlags).toContain('short_description')
  })

  it('flags competitive salary with no numbers', () => {
    const result = detectGhostIndicators({
      posted_date: new Date().toISOString(),
      salary_min: null,
      salary_max: null,
      description: 'We offer a competitive salary and great benefits. ' + 'A'.repeat(500),
      url: 'https://company.com/jobs/12345',
    })
    expect(result.ghostFlags).toContain('no_salary_competitive')
  })

  it('flags generic apply links', () => {
    const result = detectGhostIndicators({
      posted_date: new Date().toISOString(),
      salary_min: 80000,
      salary_max: 100000,
      description: 'A'.repeat(600),
      url: 'https://company.com/careers/',
    })
    expect(result.ghostFlags).toContain('generic_apply')
  })

  it('caps score at 10', () => {
    const result = detectGhostIndicators({
      posted_date: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
      repost_count: 5,
      salary_min: null,
      salary_max: null,
      description: 'competitive short',
      url: 'https://company.com/careers/',
    })
    expect(result.ghostScore).toBeLessThanOrEqual(10)
  })
})
