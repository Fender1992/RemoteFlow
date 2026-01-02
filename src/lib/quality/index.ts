// Job Quality & Reputation System
// Main exports

export {
  hashDescription,
  normalizeDescription,
  scoreDescription,
  extractSignals,
  calculateBoilerplateScore,
  type DescriptionSignals,
} from './description-analyzer'

export {
  detectGhostIndicators,
  detectGhostWithContext,
  getDaysOpen,
  isGenericApplyLink,
  type GhostFlag,
  type GhostDetectionResult,
} from './ghost-detector'

export {
  calculateHealthScore,
  calculateAgeScore,
  calculateRepostScore,
  calculateSalaryScore,
  calculateApplyScore,
  calculateFreshness,
  calculateQualityScore,
  type HealthScoreComponents,
  type HealthScoreResult,
} from './health-score'

export {
  detectRepost,
  recordJobLineage,
  updateRepostCount,
  calculateTitleSimilarity,
  type RepostResult,
} from './repost-detector'

export {
  normalizeCompanyName,
  findOrCreateCompany,
  linkJobToCompany,
  getCompanyReputation,
  incrementCompanyJobCount,
  isCompanyBlacklisted,
  getCompanyWithReputation,
  searchCompanies,
  type Company,
  type CompanyReputation,
} from './company-matcher'

// Re-export types from supabase for convenience
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Full quality calculation for a job during ingestion
 * Calculates all scores and updates the job record
 */
export async function calculateAndUpdateJobQuality(
  supabase: SupabaseClient,
  jobId: string,
  job: {
    company: string
    title: string
    description: string | null
    url: string
    source: string
    posted_date: string | null
    salary_min: number | null
    salary_max: number | null
    company_logo: string | null
  }
) {
  const { hashDescription } = await import('./description-analyzer')
  const { detectGhostIndicators } = await import('./ghost-detector')
  const { calculateHealthScore, calculateFreshness, calculateQualityScore } = await import('./health-score')
  const { detectRepost, recordJobLineage } = await import('./repost-detector')
  const {
    findOrCreateCompany,
    linkJobToCompany,
    getCompanyReputation,
    incrementCompanyJobCount,
  } = await import('./company-matcher')

  // 1. Find/create company and link
  const company = await findOrCreateCompany(supabase, job.company, job.company_logo)
  if (company) {
    await linkJobToCompany(supabase, jobId, company.id)
    await incrementCompanyJobCount(supabase, company.id)
  }

  // 2. Check for reposts
  const repostResult = await detectRepost(supabase, job)
  if (repostResult.isRepost) {
    await recordJobLineage(
      supabase,
      jobId,
      repostResult.canonicalJobId,
      repostResult.instanceNumber
    )
  } else {
    await recordJobLineage(supabase, jobId, null, 1)
  }

  // 3. Get company reputation
  const companyRep = company ? await getCompanyReputation(supabase, company.id) : 0.5

  // 4. Calculate description hash
  const descHash = hashDescription(job.description || '')

  // 5. Calculate health score
  const { healthScore } = calculateHealthScore(
    {
      posted_date: job.posted_date,
      repost_count: repostResult.instanceNumber,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      description: job.description,
      url: job.url,
    },
    companyRep
  )

  // 6. Detect ghost indicators
  const { ghostScore, ghostFlags } = detectGhostIndicators({
    posted_date: job.posted_date,
    repost_count: repostResult.instanceNumber,
    salary_min: job.salary_min,
    salary_max: job.salary_max,
    description: job.description,
    url: job.url,
  })

  // 7. Calculate final quality score
  const freshness = calculateFreshness(job.posted_date)
  const qualityScore = calculateQualityScore(healthScore, freshness, companyRep, ghostScore)

  // 8. Update job record
  await supabase.from('jobs').update({
    company_id: company?.id || null,
    description_hash: descHash,
    repost_count: repostResult.instanceNumber,
    health_score: healthScore,
    quality_score: qualityScore,
    ghost_score: ghostScore,
    ghost_flags: ghostFlags,
    quality_updated_at: new Date().toISOString(),
  }).eq('id', jobId)

  return {
    healthScore,
    qualityScore,
    ghostScore,
    ghostFlags,
    repostResult,
    companyId: company?.id,
  }
}
