import { describe, it, expect } from 'vitest'
import {
  calculateAgeScore,
  calculateRepostScore,
  calculateSalaryScore,
  calculateApplyScore,
  calculateHealthScore,
  calculateFreshness,
  calculateQualityScore,
} from './health-score'

describe('calculateAgeScore', () => {
  it('returns 1.0 for very recent jobs', () => {
    const today = new Date().toISOString()
    expect(calculateAgeScore(today)).toBe(1.0)
  })

  it('returns low score for old jobs', () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
    expect(calculateAgeScore(old)).toBe(0.1)
  })

  it('returns 1.0 for null date (0 days open)', () => {
    // getDaysOpen(null) returns 0, and 0 days <= 7, so score is 1.0
    expect(calculateAgeScore(null)).toBe(1.0)
  })
})

describe('calculateRepostScore', () => {
  it('returns 1.0 for first posting', () => {
    expect(calculateRepostScore(1)).toBe(1.0)
  })

  it('decreases with more reposts', () => {
    expect(calculateRepostScore(2)).toBe(0.7)
    expect(calculateRepostScore(3)).toBe(0.4)
    expect(calculateRepostScore(5)).toBe(0.1)
  })
})

describe('calculateSalaryScore', () => {
  it('returns 0.5 for no salary', () => {
    expect(calculateSalaryScore(null, null)).toBe(0.5)
  })

  it('returns high score for tight salary range', () => {
    expect(calculateSalaryScore(80000, 100000)).toBeGreaterThanOrEqual(0.9)
  })

  it('returns lower score for wide range', () => {
    const narrow = calculateSalaryScore(80000, 90000)
    const wide = calculateSalaryScore(50000, 200000)
    expect(narrow).toBeGreaterThan(wide)
  })

  it('returns 0.7 when only one bound given', () => {
    expect(calculateSalaryScore(80000, null)).toBe(0.7)
    expect(calculateSalaryScore(null, 100000)).toBe(0.7)
  })
})

describe('calculateApplyScore', () => {
  it('returns 1.0 for specific job links', () => {
    expect(calculateApplyScore('https://company.com/jobs/123')).toBe(1.0)
  })

  it('returns 0.3 for empty url', () => {
    expect(calculateApplyScore('')).toBe(0.3)
  })
})

describe('calculateHealthScore', () => {
  it('returns score between 0 and 1', () => {
    const result = calculateHealthScore({
      posted_date: new Date().toISOString(),
      repost_count: 1,
      salary_min: 80000,
      salary_max: 100000,
      description: 'A'.repeat(600),
      url: 'https://company.com/jobs/123',
    })
    expect(result.healthScore).toBeGreaterThanOrEqual(0)
    expect(result.healthScore).toBeLessThanOrEqual(1)
  })

  it('returns components breakdown', () => {
    const result = calculateHealthScore({
      posted_date: new Date().toISOString(),
      salary_min: null,
      salary_max: null,
      description: 'Test',
      url: 'https://company.com/jobs/123',
    })
    expect(result.components).toHaveProperty('ageScore')
    expect(result.components).toHaveProperty('repostScore')
    expect(result.components).toHaveProperty('salaryScore')
  })
})

describe('calculateFreshness', () => {
  it('delegates to calculateAgeScore', () => {
    const date = new Date().toISOString()
    expect(calculateFreshness(date)).toBe(calculateAgeScore(date))
  })
})

describe('calculateQualityScore', () => {
  it('applies ghost penalty', () => {
    const noGhost = calculateQualityScore(0.8, 0.9, 0.7, 0)
    const withGhost = calculateQualityScore(0.8, 0.9, 0.7, 5)
    expect(withGhost).toBeLessThan(noGhost)
  })

  it('returns value between 0 and 1', () => {
    const score = calculateQualityScore(0.5, 0.5, 0.5, 2)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('minimum ghost penalty is 0.1', () => {
    const score = calculateQualityScore(1, 1, 1, 20)
    expect(score).toBeGreaterThan(0)
  })
})
