// Job health score calculation
// Combines multiple signals to determine overall job health (0.0-1.0)

import { scoreDescription } from './description-analyzer'
import { getDaysOpen, isGenericApplyLink } from './ghost-detector'

export interface HealthScoreComponents {
  ageScore: number
  repostScore: number
  salaryScore: number
  descriptionScore: number
  applyScore: number
  companyRepScore: number
}

export interface HealthScoreResult {
  healthScore: number
  components: HealthScoreComponents
}

/**
 * Calculate age decay score (0.0-1.0)
 * Jobs lose value as they age:
 * - <14 days: 1.0
 * - 14-30 days: 0.9-0.7
 * - 30-60 days: 0.7-0.3
 * - 60-90 days: 0.3-0.1
 * - >90 days: 0.1
 */
export function calculateAgeScore(postedDate: string | null): number {
  const daysOpen = getDaysOpen(postedDate)

  if (daysOpen <= 7) return 1.0
  if (daysOpen <= 14) return 0.95
  if (daysOpen <= 21) return 0.85
  if (daysOpen <= 30) return 0.70
  if (daysOpen <= 45) return 0.50
  if (daysOpen <= 60) return 0.30
  if (daysOpen <= 90) return 0.15
  return 0.1
}

/**
 * Calculate repost penalty score (0.0-1.0)
 * Multiple reposts indicate the job may be hard to fill or a ghost job:
 * - 1st posting: 1.0
 * - 2nd posting: 0.7
 * - 3rd posting: 0.4
 * - 4th+ posting: 0.1
 */
export function calculateRepostScore(repostCount: number): number {
  if (repostCount <= 1) return 1.0
  if (repostCount === 2) return 0.7
  if (repostCount === 3) return 0.4
  return 0.1
}

/**
 * Calculate salary sanity score (0.0-1.0)
 * Penalizes very wide salary ranges which may indicate vague expectations:
 * - No salary: 0.5 (neutral)
 * - Reasonable range (<100% spread): 1.0
 * - Wide range (100-200% spread): 0.6
 * - Very wide range (>200% spread): 0.3
 */
export function calculateSalaryScore(
  salaryMin: number | null,
  salaryMax: number | null
): number {
  // No salary provided - neutral score
  if (!salaryMin && !salaryMax) return 0.5

  // Only one value - slight bonus for transparency
  if (!salaryMin || !salaryMax) return 0.7

  // Calculate spread percentage
  const spread = ((salaryMax - salaryMin) / salaryMin) * 100

  if (spread <= 30) return 1.0 // Very specific
  if (spread <= 50) return 0.9 // Reasonable
  if (spread <= 100) return 0.7 // Normal
  if (spread <= 200) return 0.5 // Wide
  return 0.3 // Suspiciously wide
}

/**
 * Calculate apply mechanism score (0.0-1.0)
 * Direct application links are better than generic career pages
 */
export function calculateApplyScore(url: string): number {
  if (!url) return 0.3
  if (isGenericApplyLink(url)) return 0.5
  return 1.0
}

/**
 * Calculate overall health score
 * Weights:
 * - Age decay: 25%
 * - Repost penalty: 20%
 * - Salary sanity: 15%
 * - Description quality: 15%
 * - Apply mechanism: 10%
 * - Company reputation: 15% (passed in, default 0.5)
 */
export function calculateHealthScore(
  job: {
    posted_date: string | null
    repost_count?: number
    salary_min: number | null
    salary_max: number | null
    description: string | null
    url: string
  },
  companyReputation = 0.5
): HealthScoreResult {
  const components: HealthScoreComponents = {
    ageScore: calculateAgeScore(job.posted_date),
    repostScore: calculateRepostScore(job.repost_count || 1),
    salaryScore: calculateSalaryScore(job.salary_min, job.salary_max),
    descriptionScore: scoreDescription(job.description || ''),
    applyScore: calculateApplyScore(job.url),
    companyRepScore: companyReputation,
  }

  // Weighted average
  const healthScore =
    components.ageScore * 0.25 +
    components.repostScore * 0.20 +
    components.salaryScore * 0.15 +
    components.descriptionScore * 0.15 +
    components.applyScore * 0.10 +
    components.companyRepScore * 0.15

  return {
    healthScore: Math.round(healthScore * 100) / 100,
    components,
  }
}

/**
 * Calculate freshness score (0.0-1.0) based on posted date
 * Used separately from health score for sorting
 */
export function calculateFreshness(postedDate: string | null): number {
  return calculateAgeScore(postedDate)
}

/**
 * Calculate final quality score combining health, freshness, reputation, and ghost penalty
 * Formula: ((health * 0.35) + (freshness * 0.35) + (companyRep * 0.30)) * ghostPenalty
 */
export function calculateQualityScore(
  healthScore: number,
  freshnessScore: number,
  companyReputation: number,
  ghostScore: number
): number {
  // Ghost penalty: each ghost point reduces score by 10%
  const ghostPenalty = Math.max(0.1, 1.0 - ghostScore * 0.1)

  const baseScore =
    healthScore * 0.35 + freshnessScore * 0.35 + companyReputation * 0.30

  const quality = baseScore * ghostPenalty

  return Math.round(quality * 100) / 100
}
