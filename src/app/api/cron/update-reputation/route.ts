import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateCredibilityScore, scoreToGrade, calculateHiringTrend } from '@/lib/quality/credibility'
import { verifyCronAuth } from '@/lib/auth/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

interface ReputationStats {
  totalCompaniesProcessed: number
  reputationScoresUpdated: number
  credibilityScoresUpdated: number
  companiesFlaggedForReview: number
  errors: number
  durationMs: number
}

interface CompanyMetrics {
  company_id: string
  company_name: string
  jobs_filled: number
  jobs_expired: number
  jobs_ghosted: number
  total_jobs: number
  avg_reposts_per_job: number
  response_rate: number
  reputation_score: number
  // Credibility metrics
  credibility_score: number
  credibility_grade: string
  avg_time_to_fill_days: number | null
  median_time_to_fill_days: number | null
  interview_rate: number
  offer_rate: number
  evergreen_job_count: number
  hiring_trend: 'growing' | 'stable' | 'declining'
}

/**
 * Calculate reputation score using weighted formula
 *
 * Weights:
 * - Fill rate (jobs_filled / total_jobs): 30%
 * - Non-expired rate (1 - jobs_expired / total_jobs): 20%
 * - Non-ghost rate (1 - jobs_ghosted / total_jobs): 25%
 * - Low repost rate (inverse of avg_reposts): 10%
 * - Response rate: 15%
 *
 * Score ranges from 0.0 to 1.0
 */
function calculateReputationScore(metrics: {
  jobs_filled: number
  jobs_expired: number
  jobs_ghosted: number
  total_jobs: number
  avg_reposts_per_job: number
  response_rate: number
}): number {
  const { jobs_filled, jobs_expired, jobs_ghosted, total_jobs, avg_reposts_per_job, response_rate } = metrics

  // Avoid division by zero
  if (total_jobs === 0) {
    return 0.5 // Default neutral score
  }

  // Fill rate: higher is better
  const fillRate = jobs_filled / total_jobs

  // Non-expired rate: lower expired jobs is better
  const nonExpiredRate = 1 - (jobs_expired / total_jobs)

  // Non-ghost rate: fewer ghosted jobs is better
  const nonGhostRate = 1 - (jobs_ghosted / total_jobs)

  // Low repost score: fewer reposts is better
  // avg_reposts of 1 = 1.0, 2 = 0.5, 3 = 0.33, 4+ = 0.25
  const repostScore = Math.min(1.0, 1.0 / Math.max(1, avg_reposts_per_job))

  // Response rate: already 0-1

  // Weighted calculation
  const score =
    fillRate * 0.30 +
    nonExpiredRate * 0.20 +
    nonGhostRate * 0.25 +
    repostScore * 0.10 +
    response_rate * 0.15

  // Clamp to 0-1 and round to 2 decimal places
  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100
}

/**
 * Cron job to update company reputation scores daily
 *
 * Runs the following operations:
 * 1. Gets all companies with jobs
 * 2. Calculates metrics for each company
 * 3. Updates company_reputation table
 * 4. Flags companies with low scores for review
 */
export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request)
  if (authError) return authError

  const startTime = Date.now()
  const supabase = createServiceClient()

  const stats: ReputationStats = {
    totalCompaniesProcessed: 0,
    reputationScoresUpdated: 0,
    credibilityScoresUpdated: 0,
    companiesFlaggedForReview: 0,
    errors: 0,
    durationMs: 0,
  }

  try {
    // Get all companies that have jobs
    console.log('=== Fetching companies with jobs ===')
    const { data: companiesWithJobs, error: companiesError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('is_blacklisted', false)

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`)
    }

    if (!companiesWithJobs || companiesWithJobs.length === 0) {
      console.log('No companies found')
      return NextResponse.json({
        success: true,
        message: 'No companies to process',
        stats,
      })
    }

    console.log(`Processing ${companiesWithJobs.length} companies`)
    const now = new Date()
    const companyMetrics: CompanyMetrics[] = []
    const companiesToFlag: Array<{
      company_id: string
      company_name: string
      reputation_score: number
    }> = []

    for (const company of companiesWithJobs) {
      try {
        stats.totalCompaniesProcessed++

        // Use database function to get all metrics in one query (eliminates N+1)
        const { data: metricsResult, error: metricsError } = await supabase
          .rpc('calculate_company_metrics', { p_company_id: company.id })

        let totalJobs: number
        let jobsFilled: number
        let jobsExpired: number
        let jobsGhosted: number
        let avgRepostsPerJob: number
        let responseRate: number
        let avgTimeToFillDays: number | null
        let medianTimeToFillDays: number | null
        let outcomeResponseRate: number
        let interviewRate: number
        let offerRate: number
        let evergreenJobCount: number
        let hiringTrend: 'growing' | 'stable' | 'declining'

        if (!metricsError && metricsResult) {
          // Use aggregated metrics from DB function
          const m = metricsResult as Record<string, number | null>
          totalJobs = (m.total_jobs as number) || 0
          jobsFilled = (m.jobs_filled as number) || 0
          jobsExpired = (m.jobs_expired as number) || 0
          jobsGhosted = (m.jobs_ghosted as number) || 0
          avgRepostsPerJob = (m.avg_reposts_per_job as number) || 1.0
          const totalSignals = (m.total_signals as number) || 0
          const responseSignals = (m.response_signals as number) || 0
          responseRate = totalSignals > 0 ? responseSignals / totalSignals : 0.5
          avgTimeToFillDays = m.avg_time_to_fill_days as number | null
          medianTimeToFillDays = m.median_time_to_fill_days as number | null
          const totalOutcomes = (m.total_outcomes as number) || 0
          const responsesReceived = (m.responses_received as number) || 0
          const interviewCount = (m.interview_count as number) || 0
          const offerCount = (m.offer_count as number) || 0
          outcomeResponseRate = totalOutcomes > 0 ? responsesReceived / totalOutcomes : responseRate
          interviewRate = totalOutcomes > 0 ? interviewCount / totalOutcomes : 0
          offerRate = totalOutcomes > 0 ? offerCount / totalOutcomes : 0
          evergreenJobCount = (m.evergreen_job_count as number) || 0
          hiringTrend = calculateHiringTrend((m.recent_jobs as number) || 0, (m.previous_jobs as number) || 0)
        } else {
          // Fallback: individual queries if function not available
          const { count: tc } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', company.id)
          totalJobs = tc || 0
          if (totalJobs === 0) continue
          const { count: fc } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'closed_filled')
          jobsFilled = fc || 0
          const { count: ec } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'closed_expired')
          jobsExpired = ec || 0
          const { count: gc } = await supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('company_id', company.id).gte('ghost_score', 5)
          jobsGhosted = gc || 0
          avgRepostsPerJob = 1.0
          responseRate = 0.5
          avgTimeToFillDays = null
          medianTimeToFillDays = null
          outcomeResponseRate = 0.5
          interviewRate = 0
          offerRate = 0
          evergreenJobCount = 0
          hiringTrend = 'stable'
        }

        // Skip companies with no jobs
        if (totalJobs === 0) continue

        // Calculate reputation score
        const reputationScore = calculateReputationScore({
          jobs_filled: jobsFilled,
          jobs_expired: jobsExpired,
          jobs_ghosted: jobsGhosted,
          total_jobs: totalJobs,
          avg_reposts_per_job: avgRepostsPerJob,
          response_rate: responseRate,
        })

        // Calculate credibility score
        const fillRate = totalJobs > 0 ? jobsFilled / totalJobs : 0.5
        const repostRate = avgRepostsPerJob > 1 ? Math.min(1, (avgRepostsPerJob - 1) / avgRepostsPerJob) : 0
        const ghostRatio = totalJobs > 0 ? jobsGhosted / totalJobs : 0.1

        const credibilityScore = calculateCredibilityScore({
          fillRate,
          responseRate: outcomeResponseRate,
          avgTimeToFillDays: avgTimeToFillDays ?? undefined,
          repostRate,
          ghostRatio,
          evergreenJobCount,
          totalJobsPosted: totalJobs,
        })

        const credibilityGrade = scoreToGrade(credibilityScore)

        companyMetrics.push({
          company_id: company.id,
          company_name: company.name,
          jobs_filled: jobsFilled,
          jobs_expired: jobsExpired,
          jobs_ghosted: jobsGhosted,
          total_jobs: totalJobs,
          avg_reposts_per_job: Math.round(avgRepostsPerJob * 100) / 100,
          response_rate: Math.round(outcomeResponseRate * 100) / 100,
          reputation_score: reputationScore,
          credibility_score: credibilityScore,
          credibility_grade: credibilityGrade,
          avg_time_to_fill_days: avgTimeToFillDays,
          median_time_to_fill_days: medianTimeToFillDays,
          interview_rate: Math.round(interviewRate * 100) / 100,
          offer_rate: Math.round(offerRate * 100) / 100,
          evergreen_job_count: evergreenJobCount,
          hiring_trend: hiringTrend,
        })

        // Flag companies with low reputation for review
        if (reputationScore < 0.25) {
          companiesToFlag.push({
            company_id: company.id,
            company_name: company.name,
            reputation_score: reputationScore,
          })
        }
      } catch (err) {
        console.error(`Error processing company ${company.id}:`, err)
        stats.errors++
      }
    }

    // Upsert company_reputation table
    console.log(`=== Updating ${companyMetrics.length} company reputations ===`)
    for (const metrics of companyMetrics) {
      try {
        const reputationData = {
          company_id: metrics.company_id,
          reputation_score: metrics.reputation_score,
          total_jobs_posted: metrics.total_jobs,
          jobs_filled: metrics.jobs_filled,
          jobs_expired: metrics.jobs_expired,
          jobs_ghosted: metrics.jobs_ghosted,
          avg_reposts_per_job: metrics.avg_reposts_per_job,
          score_updated_at: now.toISOString(),
          credibility_score: metrics.credibility_score,
          credibility_grade: metrics.credibility_grade,
          avg_time_to_fill_days: metrics.avg_time_to_fill_days,
          median_time_to_fill_days: metrics.median_time_to_fill_days,
          response_rate: metrics.response_rate,
          interview_rate: metrics.interview_rate,
          offer_rate: metrics.offer_rate,
          evergreen_job_count: metrics.evergreen_job_count,
          hiring_trend: metrics.hiring_trend,
        }

        const { error: upsertError } = await supabase
          .from('company_reputation')
          .upsert(reputationData, { onConflict: 'company_id' })

        if (upsertError) {
          console.error(`Error upserting reputation for ${metrics.company_id}:`, upsertError)
          stats.errors++
        } else {
          stats.reputationScoresUpdated++
          stats.credibilityScoresUpdated++
        }
      } catch (err) {
        console.error(`Error saving reputation for ${metrics.company_id}:`, err)
        stats.errors++
      }
    }

    // Flag companies with low reputation for review
    if (companiesToFlag.length > 0) {
      console.log(`=== Flagging ${companiesToFlag.length} companies for review ===`)

      for (const flag of companiesToFlag) {
        try {
          const { error: insertError } = await supabase
            .from('review_queue')
            .insert({
              company_id: flag.company_id,
              reason: `Low reputation score (${flag.reputation_score}): ${flag.company_name}`,
              type: 'low_reputation',
              priority: flag.reputation_score < 0.15 ? 'high' : 'medium',
              status: 'pending',
              created_at: now.toISOString(),
            })

          if (insertError) {
            // Ignore duplicate key errors
            if (insertError.code !== '23505') {
              console.error(`Error flagging company ${flag.company_id}:`, insertError)
              stats.errors++
            }
          } else {
            stats.companiesFlaggedForReview++
          }
        } catch (err) {
          console.error(`Error flagging company ${flag.company_id}:`, err)
          stats.errors++
        }
      }
    }

    stats.durationMs = Date.now() - startTime

    console.log('=== Reputation update complete ===')
    console.log(`Processed: ${stats.totalCompaniesProcessed}`)
    console.log(`Reputation scores updated: ${stats.reputationScoresUpdated}`)
    console.log(`Credibility scores updated: ${stats.credibilityScoresUpdated}`)
    console.log(`Flagged: ${stats.companiesFlaggedForReview}`)
    console.log(`Errors: ${stats.errors}`)
    console.log(`Duration: ${stats.durationMs}ms`)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Reputation update error:', error)
    stats.durationMs = Date.now() - startTime

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stats,
      },
      { status: 500 }
    )
  }
}

