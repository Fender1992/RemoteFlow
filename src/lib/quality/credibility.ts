// Company credibility scoring module
// Calculates a 0-1 credibility score based on hiring metrics

export interface CompanyMetrics {
  fillRate?: number // 0-1: percentage of jobs that get filled
  responseRate?: number // 0-1: percentage of applications that get a response
  avgTimeToFillDays?: number // average days to fill a position
  repostRate?: number // 0-1: percentage of jobs that get reposted
  ghostRatio?: number // 0-1: ratio of ghost jobs to total jobs
  evergreenJobCount?: number // number of evergreen/perpetually open jobs
  totalJobsPosted?: number // total jobs posted by company
  isVerified?: boolean // whether the company is verified
}

export interface CredibilityResult {
  score: number
  grade: string
  redFlags: string[]
  isVerified: boolean
  components: {
    fillRateScore: number
    responseRateScore: number
    timeToFillScore: number
    repostScore: number
    ghostScore: number
  }
}

/**
 * Calculate time-to-fill score (0.0-1.0)
 * Normalizes average time to fill:
 * - <30 days: 1.0 (excellent)
 * - 30-60 days: linear interpolation from 1.0 to 0.5
 * - 60-90 days: linear interpolation from 0.5 to 0.0
 * - >90 days: 0.0 (poor)
 * - null: 0.5 (unknown, neutral score)
 */
export function calculateTimeToFillScore(avgDays: number | null): number {
  if (avgDays === null || avgDays === undefined) {
    return 0.5 // Unknown, return neutral
  }

  if (avgDays <= 30) {
    return 1.0
  }

  if (avgDays <= 60) {
    // Linear interpolation from 1.0 at 30 days to 0.5 at 60 days
    return 1.0 - ((avgDays - 30) / 30) * 0.5
  }

  if (avgDays <= 90) {
    // Linear interpolation from 0.5 at 60 days to 0.0 at 90 days
    return 0.5 - ((avgDays - 60) / 30) * 0.5
  }

  return 0.0
}

/**
 * Calculate the overall credibility score for a company
 *
 * Formula:
 * credibility_score = (
 *   fillRate * 0.30 +           // Higher fill rate = better
 *   responseRate * 0.25 +       // Higher response rate = better
 *   timeToFillScore * 0.20 +    // Faster hiring = better
 *   (1 - repostRate) * 0.15 +   // Lower repost rate = better
 *   (1 - ghostRatio) * 0.10     // Fewer ghost jobs = better
 * )
 *
 * @param metrics - Company hiring metrics
 * @returns 0-1 credibility score
 */
export function calculateCredibilityScore(metrics: CompanyMetrics): number {
  // Use defaults for missing metrics (neutral values)
  const fillRate = metrics.fillRate ?? 0.5
  const responseRate = metrics.responseRate ?? 0.5
  const avgTimeToFillDays = metrics.avgTimeToFillDays ?? null
  const repostRate = metrics.repostRate ?? 0.15
  const ghostRatio = metrics.ghostRatio ?? 0.1

  // Calculate time-to-fill score
  const timeToFillScore = calculateTimeToFillScore(avgTimeToFillDays)

  // Calculate weighted score
  const score =
    fillRate * 0.30 +
    responseRate * 0.25 +
    timeToFillScore * 0.20 +
    (1 - repostRate) * 0.15 +
    (1 - ghostRatio) * 0.10

  // Clamp to 0-1 range and round to 2 decimal places
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100
}

/**
 * Convert a credibility score (0-1) to a letter grade
 *
 * Grading scale:
 * - A+ : 0.97-1.00
 * - A  : 0.93-0.96
 * - A- : 0.90-0.92
 * - B+ : 0.87-0.89
 * - B  : 0.83-0.86
 * - B- : 0.80-0.82
 * - C+ : 0.77-0.79
 * - C  : 0.73-0.76
 * - C- : 0.70-0.72
 * - D  : 0.60-0.69
 * - F  : 0.00-0.59
 *
 * @param score - 0-1 credibility score
 * @returns Letter grade string
 */
export function scoreToGrade(score: number): string {
  if (score >= 0.97) return 'A+'
  if (score >= 0.93) return 'A'
  if (score >= 0.90) return 'A-'
  if (score >= 0.87) return 'B+'
  if (score >= 0.83) return 'B'
  if (score >= 0.80) return 'B-'
  if (score >= 0.77) return 'C+'
  if (score >= 0.73) return 'C'
  if (score >= 0.70) return 'C-'
  if (score >= 0.60) return 'D'
  return 'F'
}

/**
 * Calculate hiring trend based on recent vs previous job posting activity
 *
 * @param recentJobs - Number of jobs posted in recent period
 * @param previousJobs - Number of jobs posted in previous period
 * @returns Trend indicator: 'growing', 'stable', or 'declining'
 */
export function calculateHiringTrend(
  recentJobs: number,
  previousJobs: number
): 'growing' | 'stable' | 'declining' {
  // Handle edge cases
  if (previousJobs === 0 && recentJobs === 0) {
    return 'stable'
  }

  if (previousJobs === 0 && recentJobs > 0) {
    return 'growing'
  }

  if (recentJobs === 0 && previousJobs > 0) {
    return 'declining'
  }

  // Calculate percentage change
  const changePercent = ((recentJobs - previousJobs) / previousJobs) * 100

  // Thresholds for trend determination
  if (changePercent >= 20) {
    return 'growing'
  }

  if (changePercent <= -20) {
    return 'declining'
  }

  return 'stable'
}

/**
 * Identify red flags in company hiring metrics
 *
 * Red flags checked:
 * - Response rate < 20%
 * - Avg time to fill > 60 days
 * - Repost rate > 30%
 * - Ghost ratio > 3 ghost jobs (calculated as ghostRatio * totalJobsPosted > 3)
 * - Evergreen job count > 2
 *
 * @param metrics - Company hiring metrics
 * @returns Array of red flag descriptions
 */
export function getRedFlags(metrics: CompanyMetrics): string[] {
  const redFlags: string[] = []

  // Response rate < 20%
  if (metrics.responseRate !== undefined && metrics.responseRate < 0.20) {
    const responsePercent = Math.round(metrics.responseRate * 100)
    redFlags.push(`Low response rate (${responsePercent}%)`)
  }

  // Avg time to fill > 60 days
  if (
    metrics.avgTimeToFillDays !== undefined &&
    metrics.avgTimeToFillDays !== null &&
    metrics.avgTimeToFillDays > 60
  ) {
    redFlags.push(`Slow hiring process (${Math.round(metrics.avgTimeToFillDays)} days average)`)
  }

  // Repost rate > 30%
  if (metrics.repostRate !== undefined && metrics.repostRate > 0.30) {
    const repostPercent = Math.round(metrics.repostRate * 100)
    redFlags.push(`High job reposting rate (${repostPercent}%)`)
  }

  // Ghost job count > 3
  if (
    metrics.ghostRatio !== undefined &&
    metrics.totalJobsPosted !== undefined &&
    metrics.totalJobsPosted > 0
  ) {
    const ghostJobCount = Math.round(metrics.ghostRatio * metrics.totalJobsPosted)
    if (ghostJobCount > 3) {
      redFlags.push(`Multiple suspected ghost jobs (${ghostJobCount})`)
    }
  }

  // Evergreen job count > 2
  if (metrics.evergreenJobCount !== undefined && metrics.evergreenJobCount > 2) {
    redFlags.push(`Multiple evergreen positions (${metrics.evergreenJobCount})`)
  }

  return redFlags
}

/**
 * Calculate full credibility analysis for a company
 *
 * @param metrics - Company hiring metrics
 * @returns Complete credibility result with score, grade, red flags, and components
 */
export function analyzeCredibility(metrics: CompanyMetrics): CredibilityResult {
  const fillRate = metrics.fillRate ?? 0.5
  const responseRate = metrics.responseRate ?? 0.5
  const repostRate = metrics.repostRate ?? 0.15
  const ghostRatio = metrics.ghostRatio ?? 0.1
  const timeToFillScore = calculateTimeToFillScore(metrics.avgTimeToFillDays ?? null)

  const score = calculateCredibilityScore(metrics)
  const grade = scoreToGrade(score)
  const redFlags = getRedFlags(metrics)

  return {
    score,
    grade,
    redFlags,
    isVerified: !!metrics.isVerified,
    components: {
      fillRateScore: fillRate,
      responseRateScore: responseRate,
      timeToFillScore,
      repostScore: 1 - repostRate,
      ghostScore: 1 - ghostRatio,
    },
  }
}
