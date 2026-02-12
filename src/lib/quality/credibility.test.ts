import { describe, it, expect } from 'vitest'
import {
  calculateCredibilityScore,
  scoreToGrade,
  calculateHiringTrend,
  calculateTimeToFillScore,
  getRedFlags,
  analyzeCredibility,
} from './credibility'

describe('calculateCredibilityScore', () => {
  it('returns neutral score for empty metrics', () => {
    const score = calculateCredibilityScore({})
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('returns high score for excellent metrics', () => {
    const score = calculateCredibilityScore({
      fillRate: 0.9,
      responseRate: 0.85,
      avgTimeToFillDays: 20,
      repostRate: 0.05,
      ghostRatio: 0.02,
    })
    expect(score).toBeGreaterThan(0.85)
  })

  it('returns low score for poor metrics', () => {
    const score = calculateCredibilityScore({
      fillRate: 0.1,
      responseRate: 0.1,
      avgTimeToFillDays: 100,
      repostRate: 0.8,
      ghostRatio: 0.5,
    })
    expect(score).toBeLessThan(0.4)
  })

  it('clamps score between 0 and 1', () => {
    const high = calculateCredibilityScore({
      fillRate: 1,
      responseRate: 1,
      avgTimeToFillDays: 1,
      repostRate: 0,
      ghostRatio: 0,
    })
    expect(high).toBeLessThanOrEqual(1)

    const low = calculateCredibilityScore({
      fillRate: 0,
      responseRate: 0,
      avgTimeToFillDays: 200,
      repostRate: 1,
      ghostRatio: 1,
    })
    expect(low).toBeGreaterThanOrEqual(0)
  })
})

describe('scoreToGrade', () => {
  it('returns A+ for scores >= 0.97', () => {
    expect(scoreToGrade(0.97)).toBe('A+')
    expect(scoreToGrade(1.0)).toBe('A+')
  })

  it('returns F for scores < 0.60', () => {
    expect(scoreToGrade(0.59)).toBe('F')
    expect(scoreToGrade(0.0)).toBe('F')
  })

  it('returns correct intermediate grades', () => {
    expect(scoreToGrade(0.93)).toBe('A')
    expect(scoreToGrade(0.83)).toBe('B')
    expect(scoreToGrade(0.73)).toBe('C')
    expect(scoreToGrade(0.60)).toBe('D')
  })
})

describe('calculateHiringTrend', () => {
  it('returns stable for equal job counts', () => {
    expect(calculateHiringTrend(10, 10)).toBe('stable')
  })

  it('returns growing when recent > previous by 20%+', () => {
    expect(calculateHiringTrend(15, 10)).toBe('growing')
  })

  it('returns declining when recent < previous by 20%+', () => {
    expect(calculateHiringTrend(5, 10)).toBe('declining')
  })

  it('handles zero values', () => {
    expect(calculateHiringTrend(0, 0)).toBe('stable')
    expect(calculateHiringTrend(5, 0)).toBe('growing')
    expect(calculateHiringTrend(0, 5)).toBe('declining')
  })
})

describe('calculateTimeToFillScore', () => {
  it('returns 1.0 for fast fills (<= 30 days)', () => {
    expect(calculateTimeToFillScore(10)).toBe(1.0)
    expect(calculateTimeToFillScore(30)).toBe(1.0)
  })

  it('returns 0.5 for neutral (null)', () => {
    expect(calculateTimeToFillScore(null)).toBe(0.5)
  })

  it('returns 0 for slow fills (>= 90 days)', () => {
    expect(calculateTimeToFillScore(90)).toBe(0.0)
    expect(calculateTimeToFillScore(120)).toBe(0.0)
  })

  it('interpolates between 30-60 days', () => {
    const score = calculateTimeToFillScore(45)
    expect(score).toBeGreaterThan(0.5)
    expect(score).toBeLessThan(1.0)
  })
})

describe('getRedFlags', () => {
  it('returns empty array for good metrics', () => {
    const flags = getRedFlags({ responseRate: 0.5, avgTimeToFillDays: 30 })
    expect(flags).toHaveLength(0)
  })

  it('flags low response rate', () => {
    const flags = getRedFlags({ responseRate: 0.1 })
    expect(flags.some(f => f.includes('response rate'))).toBe(true)
  })

  it('flags slow hiring', () => {
    const flags = getRedFlags({ avgTimeToFillDays: 80 })
    expect(flags.some(f => f.includes('hiring process'))).toBe(true)
  })

  it('flags high repost rate', () => {
    const flags = getRedFlags({ repostRate: 0.5 })
    expect(flags.some(f => f.includes('reposting'))).toBe(true)
  })
})

describe('analyzeCredibility', () => {
  it('returns complete analysis result', () => {
    const result = analyzeCredibility({
      fillRate: 0.7,
      responseRate: 0.6,
      avgTimeToFillDays: 45,
    })

    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('grade')
    expect(result).toHaveProperty('redFlags')
    expect(result).toHaveProperty('components')
    expect(typeof result.score).toBe('number')
    expect(typeof result.grade).toBe('string')
    expect(Array.isArray(result.redFlags)).toBe(true)
  })
})
