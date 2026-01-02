// Ghost job detection
// Calculates ghost_score (0-10 points) based on suspicious indicators

import type { SupabaseClient } from '@supabase/supabase-js'

export type GhostFlag =
  | 'open_90_days'
  | 'reposted_4_plus'
  | 'too_many_openings'
  | 'multi_location'
  | 'no_salary_competitive'
  | 'short_description'
  | 'generic_apply'

export interface GhostDetectionResult {
  ghostScore: number
  ghostFlags: GhostFlag[]
}

/**
 * Calculate days since job was posted
 */
export function getDaysOpen(postedDate: string | null): number {
  if (!postedDate) return 0

  const posted = new Date(postedDate)
  const now = new Date()
  const diffMs = now.getTime() - posted.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Check if apply link is a generic careers page
 */
export function isGenericApplyLink(url: string): boolean {
  const genericPatterns = [
    /\/careers\/?$/i,
    /\/jobs\/?$/i,
    /\/careers\/[^/]+\/?$/i,
    /lever\.co\/[^/]+\/?$/i,
    /greenhouse\.io\/[^/]+\/?$/i,
    /workday\.com\/[^/]+\/?$/i,
    /careers\.(google|facebook|amazon|microsoft|apple)\.com\/?$/i,
  ]

  return genericPatterns.some((pattern) => pattern.test(url))
}

/**
 * Detect ghost job indicators for a single job
 * Returns ghost_score (0-10) and list of flags
 */
export function detectGhostIndicators(job: {
  posted_date: string | null
  repost_count?: number
  salary_min: number | null
  salary_max: number | null
  description: string | null
  url: string
}): GhostDetectionResult {
  const flags: GhostFlag[] = []
  let score = 0

  // +3: Open >90 days
  const daysOpen = getDaysOpen(job.posted_date)
  if (daysOpen > 90) {
    flags.push('open_90_days')
    score += 3
  }

  // +3: Reposted 4+ times
  if (job.repost_count && job.repost_count >= 4) {
    flags.push('reposted_4_plus')
    score += 3
  }

  // +1: No salary + "competitive" mentioned
  const hasNoSalary = !job.salary_min && !job.salary_max
  const mentionsCompetitive = job.description?.toLowerCase().includes('competitive') ?? false
  if (hasNoSalary && mentionsCompetitive) {
    flags.push('no_salary_competitive')
    score += 1
  }

  // +1: Description <500 chars
  const descriptionLength = job.description?.length ?? 0
  if (descriptionLength < 500) {
    flags.push('short_description')
    score += 1
  }

  // +2: Apply link is generic careers page
  if (isGenericApplyLink(job.url)) {
    flags.push('generic_apply')
    score += 2
  }

  return {
    ghostScore: Math.min(score, 10),
    ghostFlags: flags,
  }
}

/**
 * Advanced ghost detection using database context
 * Checks company-level patterns
 */
export async function detectGhostWithContext(
  supabase: SupabaseClient,
  job: {
    id: string
    company: string
    company_id: string | null
    title: string
    posted_date: string | null
    repost_count?: number
    salary_min: number | null
    salary_max: number | null
    description: string | null
    url: string
  }
): Promise<GhostDetectionResult> {
  // Start with basic detection
  const result = detectGhostIndicators(job)

  if (!job.company_id) {
    return result
  }

  // +2: Company has >20 open roles (may indicate ghost job farm)
  const { count: openRoles } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', job.company_id)
    .eq('is_active', true)

  if (openRoles && openRoles > 20) {
    // Check if this is a large company (we'd need employee_count from companies table)
    const { data: company } = await supabase
      .from('companies')
      .select('employee_count')
      .eq('id', job.company_id)
      .single()

    // If unknown company size or small company with many listings
    if (!company?.employee_count || company.employee_count < 500) {
      result.ghostFlags.push('too_many_openings')
      result.ghostScore = Math.min(result.ghostScore + 2, 10)
    }
  }

  // +2: Same role title in 10+ different locations (multi-posting)
  const { count: sameTitle } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', job.company_id)
    .eq('title', job.title)
    .eq('is_active', true)

  if (sameTitle && sameTitle >= 10) {
    result.ghostFlags.push('multi_location')
    result.ghostScore = Math.min(result.ghostScore + 2, 10)
  }

  return result
}
