import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { calculateCredibilityScore, scoreToGrade, calculateHiringTrend } from '@/lib/quality/credibility'

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
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const vercelCronHeader = request.headers.get('x-vercel-cron')

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && vercelCronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

        // Get job counts by status
        const { count: totalJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)

        // Skip companies with no jobs
        if (!totalJobs || totalJobs === 0) {
          continue
        }

        // Count jobs by status
        const { count: jobsFilled } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('status', 'closed_filled')

        const { count: jobsExpired } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('status', 'closed_expired')

        // Count ghosted jobs (ghost_score >= 5)
        const { count: jobsGhosted } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .gte('ghost_score', 5)

        // Calculate average reposts per job
        const { data: repostData } = await supabase
          .from('jobs')
          .select('repost_count')
          .eq('company_id', company.id)
          .not('repost_count', 'is', null)

        let avgRepostsPerJob = 1.0
        if (repostData && repostData.length > 0) {
          const totalReposts = repostData.reduce((sum, job) => sum + (job.repost_count || 1), 0)
          avgRepostsPerJob = totalReposts / repostData.length
        }

        // Calculate response rate from job_signals
        const { count: totalSignals } = await supabase
          .from('job_signals')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)

        const { count: responseSignals } = await supabase
          .from('job_signals')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('signal_type', 'response_received')

        const responseRate = totalSignals && totalSignals > 0
          ? (responseSignals || 0) / totalSignals
          : 0.5 // Default to neutral if no signals

        // Calculate reputation score
        const reputationScore = calculateReputationScore({
          jobs_filled: jobsFilled || 0,
          jobs_expired: jobsExpired || 0,
          jobs_ghosted: jobsGhosted || 0,
          total_jobs: totalJobs,
          avg_reposts_per_job: avgRepostsPerJob,
          response_rate: responseRate,
        })

        // Calculate time to fill metrics from jobs with lifecycle_status = 'filled'
        const { data: filledJobsData } = await supabase
          .from('jobs')
          .select('days_to_fill')
          .eq('company_id', company.id)
          .eq('lifecycle_status', 'filled')
          .not('days_to_fill', 'is', null)

        let avgTimeToFillDays: number | null = null
        let medianTimeToFillDays: number | null = null

        if (filledJobsData && filledJobsData.length > 0) {
          const fillTimes = filledJobsData.map(j => j.days_to_fill).filter((d): d is number => d !== null)
          if (fillTimes.length > 0) {
            avgTimeToFillDays = Math.round(fillTimes.reduce((a, b) => a + b, 0) / fillTimes.length)
            // Calculate median
            const sorted = [...fillTimes].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            medianTimeToFillDays = sorted.length % 2 !== 0
              ? sorted[mid]
              : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
          }
        }

        // Calculate application outcome rates from application_outcomes table
        const { count: totalOutcomes } = await supabase
          .from('application_outcomes')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)

        const { count: responsesReceived } = await supabase
          .from('application_outcomes')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .neq('outcome', 'no_response')

        const { count: interviewCount } = await supabase
          .from('application_outcomes')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .in('outcome', ['interview', 'offer', 'hired'])

        const { count: offerCount } = await supabase
          .from('application_outcomes')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .in('outcome', ['offer', 'hired'])

        const outcomeResponseRate = totalOutcomes && totalOutcomes > 0
          ? (responsesReceived || 0) / totalOutcomes
          : responseRate // Fall back to existing response rate
        const interviewRate = totalOutcomes && totalOutcomes > 0
          ? (interviewCount || 0) / totalOutcomes
          : 0
        const offerRate = totalOutcomes && totalOutcomes > 0
          ? (offerCount || 0) / totalOutcomes
          : 0

        // Count evergreen jobs
        const { count: evergreenJobCount } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .eq('is_evergreen', true)

        // Calculate hiring trend (compare last 30 days vs previous 30 days)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

        const { count: recentJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .gte('created_at', thirtyDaysAgo.toISOString())

        const { count: previousJobs } = await supabase
          .from('jobs')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .gte('created_at', sixtyDaysAgo.toISOString())
          .lt('created_at', thirtyDaysAgo.toISOString())

        const hiringTrend = calculateHiringTrend(recentJobs || 0, previousJobs || 0)

        // Calculate credibility score
        const fillRate = totalJobs > 0 ? (jobsFilled || 0) / totalJobs : 0.5
        const repostRate = avgRepostsPerJob > 1 ? Math.min(1, (avgRepostsPerJob - 1) / avgRepostsPerJob) : 0
        const ghostRatio = totalJobs > 0 ? (jobsGhosted || 0) / totalJobs : 0.1

        const credibilityScore = calculateCredibilityScore({
          fillRate,
          responseRate: outcomeResponseRate,
          avgTimeToFillDays: avgTimeToFillDays ?? undefined,
          repostRate,
          ghostRatio,
          evergreenJobCount: evergreenJobCount || 0,
          totalJobsPosted: totalJobs,
        })

        const credibilityGrade = scoreToGrade(credibilityScore)

        companyMetrics.push({
          company_id: company.id,
          company_name: company.name,
          jobs_filled: jobsFilled || 0,
          jobs_expired: jobsExpired || 0,
          jobs_ghosted: jobsGhosted || 0,
          total_jobs: totalJobs,
          avg_reposts_per_job: Math.round(avgRepostsPerJob * 100) / 100,
          response_rate: Math.round(outcomeResponseRate * 100) / 100,
          reputation_score: reputationScore,
          // Credibility metrics
          credibility_score: credibilityScore,
          credibility_grade: credibilityGrade,
          avg_time_to_fill_days: avgTimeToFillDays,
          median_time_to_fill_days: medianTimeToFillDays,
          interview_rate: Math.round(interviewRate * 100) / 100,
          offer_rate: Math.round(offerRate * 100) / 100,
          evergreen_job_count: evergreenJobCount || 0,
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

    // Update company_reputation table
    console.log(`=== Updating ${companyMetrics.length} company reputations ===`)
    for (const metrics of companyMetrics) {
      try {
        // Check if reputation record exists
        const { data: existing } = await supabase
          .from('company_reputation')
          .select('company_id')
          .eq('company_id', metrics.company_id)
          .single()

        const reputationData = {
          company_id: metrics.company_id,
          reputation_score: metrics.reputation_score,
          total_jobs_posted: metrics.total_jobs,
          jobs_filled: metrics.jobs_filled,
          jobs_expired: metrics.jobs_expired,
          jobs_ghosted: metrics.jobs_ghosted,
          avg_reposts_per_job: metrics.avg_reposts_per_job,
          score_updated_at: now.toISOString(),
          // Credibility metrics
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

        if (existing) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('company_reputation')
            .update(reputationData)
            .eq('company_id', metrics.company_id)

          if (updateError) {
            console.error(`Error updating reputation for ${metrics.company_id}:`, updateError)
            stats.errors++
          } else {
            stats.reputationScoresUpdated++
            stats.credibilityScoresUpdated++
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('company_reputation')
            .insert(reputationData)

          if (insertError) {
            console.error(`Error inserting reputation for ${metrics.company_id}:`, insertError)
            stats.errors++
          } else {
            stats.reputationScoresUpdated++
            stats.credibilityScoresUpdated++
          }
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
          // Check if already in review queue
          const { data: existing } = await supabase
            .from('review_queue')
            .select('id')
            .eq('company_id', flag.company_id)
            .eq('status', 'pending')
            .single()

          if (!existing) {
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

// Allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request)
}
